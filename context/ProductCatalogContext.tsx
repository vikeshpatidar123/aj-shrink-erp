"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { GravureProductCatalog } from "@/data/dummyData";
import { apiGet, apiPost } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

// ── API row shape from getcataloglist ──────────────────────────────────────
type ApiCatalogRow = {
  ProductMasterID: string; ProductMasterCode: string; PCDate: string;
  ProductName: string; CustomerID: string; CustomerName: string;
  CategoryID: string; CategoryName: string; Content: string; GrvContent?: string;
  JobWidth: number; JobHeight: number; ActualWidth: number; ActualHeight: number;
  NoOfColors: number; FrontColors: number; BackColors: number;
  PrintType: string; Substrate: string; MachineID: string; MachineName: string;
  CylinderCostPerColor: number; OverheadPct: number; ProfitPct: number;
  PerMeterRate: number; TrimmingSize: number; WidthShrinkage: number;
  StructureType: string; GussetSize: number; SeamingArea: number; TransparentArea: number;
  Gusset: number; SealSize: number; HasZipper: number;
  HasSpout: number; HasValve: number; LaminationPlies: number;
  ZipperWeight: number; SpoutWeight: number;
  TopSeal: number; BottomSeal: number; SideSeal: number; CenterSealWidth: number;
  SideGusset: number; RepeatLength: number; RepeatShrinkage: number;
  PackWidth: number; PackHeight: number; HMargin: number; VMargin: number;
  AcrossUPS: number; VerticalUPS: number; PrintedLength: number;
  EyeMarkLength: number; GapLength: number; UnwindDirection: number;
  FinalRollOD: number; RollQtyUnit: string; PackSize: string; BrandName: string;
  ProductType: string; SkuType: string; BottleType: string;
  AddressType: string; SpecialSpecs: string; ArtworkName: string;
  SourceEstimationID: string; SourceEstimationNo: string;
  SourceOrderID: string; SourceOrderNo: string;
  SourceWorkOrderID: string; SourceWorkOrderNo: string;
  IsActive: number; IsActiveReason: string;
  SavedPlanID: string; SavedColorShadesJSON?: string; SavedCylAllocsJSON?: string; SavedLayersJSON?: string;
  SavedProcessesJSON?: string; SavedAttachmentsJSON?: string;
  LinkedArtworkID?: string;
  StandardQty: number; StandardUnit: string; Remarks: string;
  GrvPlanSleeveID?: string;
  GrvPlanSleeveName?: string;
  GrvPlanFilmWidth: number;
  GrvPlanSideWaste: number;
  GrvPlanTotalWaste: number;
  GrvPlanCylCode: string;
  GrvPlanCylName?: string;
  GrvPlanCylWidth: number;
  GrvPlanCylExtra: number;
  GrvPlanCylCirc: number;
  GrvPlanRepeatUPS: number;
  GrvPlanTotalPieces: number;
  GrvSavedPlanJSON?: string;
  ContentSizeValues?: string;
};

function mapApiRow(r: ApiCatalogRow): GravureProductCatalog {
  const tryParse = (s: string | null | undefined) => {
    if (!s) return undefined;
    try { return JSON.parse(s); } catch { return undefined; }
  };
  return {
    id: String(r.ProductMasterID ?? ""),
    catalogNo: r.ProductMasterCode,
    createdDate: r.PCDate ?? "",
    productName: r.ProductName ?? "",
    customerId: String(r.CustomerID ?? ""),
    customerName: r.CustomerName ?? "",
    categoryId: String(r.CategoryID ?? ""),
    categoryName: r.CategoryName ?? "",
    content: r.Content || r.GrvContent || "",
    jobWidth: Number(r.JobWidth ?? 0),
    jobHeight: Number(r.JobHeight ?? 0),
    actualWidth: Number(r.ActualWidth ?? 0),
    actualHeight: Number(r.ActualHeight ?? 0),
    noOfColors: Number(r.NoOfColors ?? 0),
    frontColors: Number(r.FrontColors ?? 0),
    backColors: Number(r.BackColors ?? 0),
    printType: (r.PrintType as any) ?? "Reverse Print",
    substrate: r.Substrate ?? "",
    machineId: String(r.MachineID ?? ""),
    machineName: r.MachineName ?? "",
    cylinderCostPerColor: Number(r.CylinderCostPerColor ?? 0),
    overheadPct: Number(r.OverheadPct ?? 0),
    profitPct: Number(r.ProfitPct ?? 0),
    perMeterRate: Number(r.PerMeterRate ?? 0),
    trimmingSize: Number(r.TrimmingSize ?? 0),
    widthShrinkage: Number(r.WidthShrinkage ?? 0),
    structureType: (r.StructureType as any) ?? "Sleeve",
    gussetSize: Number(r.GussetSize ?? 0),
    seamingArea: Number(r.SeamingArea ?? 0),
    transparentArea: Number(r.TransparentArea ?? 0),
    gusset: Number(r.Gusset ?? 0),
    sealSize: Number(r.SealSize ?? 0),
    hasZipper: Number(r.HasZipper ?? 0) === 1,
    hasSpout: Number(r.HasSpout ?? 0) === 1,
    hasValve: Number(r.HasValve ?? 0) === 1,
    laminationPlies: Number(r.LaminationPlies ?? 0),
    zipperWeight: Number(r.ZipperWeight ?? 0),
    spoutWeight: Number(r.SpoutWeight ?? 0),
    topSeal: Number(r.TopSeal ?? 0),
    bottomSeal: Number(r.BottomSeal ?? 0),
    sideSeal: Number(r.SideSeal ?? 0),
    centerSealWidth: Number(r.CenterSealWidth ?? 0),
    sideGusset: Number(r.SideGusset ?? 0),
    repeatLength: Number(r.RepeatLength ?? 0),
    repeatShrinkage: Number(r.RepeatShrinkage ?? 0),
    packWidth: Number(r.PackWidth ?? 0),
    packHeight: Number(r.PackHeight ?? 0),
    hMargin: Number(r.HMargin ?? 0),
    vMargin: Number(r.VMargin ?? 0),
    acrossUPS: Number(r.AcrossUPS ?? 0),
    verticalUPS: Number(r.VerticalUPS ?? 0),
    printedLength: Number(r.PrintedLength ?? 0),
    eyeMarkLength: Number(r.EyeMarkLength ?? 0),
    gapLength: Number(r.GapLength ?? 0),
    unwindDirection: Number(r.UnwindDirection ?? 0),
    finalRollOD: Number(r.FinalRollOD ?? 0),
    rollQtyUnit: r.RollQtyUnit ?? "Meter",
    packSize: r.PackSize ?? "",
    brandName: r.BrandName ?? "",
    productType: r.ProductType ?? "",
    skuType: r.SkuType ?? "",
    bottleType: r.BottleType ?? "",
    addressType: (r.AddressType as any) ?? undefined,
    specialSpecs: r.SpecialSpecs ?? "",
    artworkName: r.ArtworkName ?? "",
    artworkId: r.LinkedArtworkID ?? "",
    sourceEstimationId: String(r.SourceEstimationID ?? ""),
    sourceEstimationNo: r.SourceEstimationNo ?? "",
    sourceOrderId: String(r.SourceOrderID ?? ""),
    sourceOrderNo: r.SourceOrderNo ?? "",
    sourceWorkOrderId: String(r.SourceWorkOrderID ?? ""),
    sourceWorkOrderNo: r.SourceWorkOrderNo ?? "",
    savedPlanId: String(r.SavedPlanID ?? ""),
    savedPlan: tryParse(r.ContentSizeValues) ?? tryParse(r.GrvSavedPlanJSON),
    savedColorShades: tryParse(r.SavedColorShadesJSON),
    savedCylAllocs: tryParse(r.SavedCylAllocsJSON),
    standardQty: Number(r.StandardQty ?? 0),
    standardUnit: r.StandardUnit ?? "Meter",
    remarks: r.Remarks ?? "",
    isActive: Number(r.IsActive ?? 0) === 0,
    isActiveReason: r.IsActiveReason ?? "",
    status: Number(r.IsActive ?? 0) === 0 ? "Active" : "Inactive",
    secondaryLayers: (() => {
      const parsed = tryParse(r.SavedLayersJSON);
      const arr = Array.isArray(parsed) ? parsed : [];
      return arr.map((l: any) => ({
        ...l,
        // SQL FOR JSON PATH returns ItemID as number — stringify so items.find(x => x.id === l.itemId) works
        itemId: String(l.itemId ?? ""),
        // storedSubGroup (PlanContName) and storedDensity (PlanContQty) are saved per-layer to survive the itemId mismatch
        itemSubGroup: String(l.storedSubGroup || l.itemSubGroup || ""),
        density: Number(l.filmDensity || l.density || 0),
        // normalize layer fields (DB stores gsm as GSMTakeUp mapped to 'gsm', rate as filmRate/rate)
        gsm:    l.gsm    ?? l.filmGSM   ?? 0,
        filmGSM:l.filmGSM?? l.gsm       ?? 0,
        filmRate:l.filmRate ?? l.rate   ?? 0,
        consumableItems: Array.isArray(l.consumableItems)
          ? l.consumableItems.map((c: any) => ({
              ...c,
              consumableId: String(c.consumableId ?? c.ConsumableID ?? `${l.layerNo}-${c.itemId ?? Math.random()}`),
              itemId: String(c.itemId ?? ""),  // same fix for consumable item IDs
              // normalize: backend saves as dryGSM/solidPercentage, UI reads as gsm/solidPct
              gsm:      c.gsm      ?? c.dryGSM            ?? 0,
              dryGSM:   c.dryGSM   ?? c.gsm               ?? 0,
              solidPct: (c.solidPct > 0 ? c.solidPct : (c.solidPercentage > 0 ? c.solidPercentage : 40)),
              solidPercentage: c.solidPercentage ?? c.solidPct ?? 0,
              liquidGSM: c.liquidGSM ?? 0,
              ratioPct:  c.ratioPct  ?? 0,
              itemGroup:    c.itemGroup    ?? c.consumableType ?? c.itemGroupName    ?? "",
              itemSubGroup: c.itemSubGroup ?? c.itemSubGroupName ?? "",
            }))
          : [],
      }));
    })(),
    processes: tryParse(r.SavedProcessesJSON) ?? [],
    attachments: tryParse(r.SavedAttachmentsJSON) ?? [],
  };
}

  // ── Context type ───────────────────────────────────────────────────────────
  type CatalogCtxType = {
    catalog: GravureProductCatalog[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    saveCatalogItem: (item: GravureProductCatalog) => Promise<string | null>;
    updateCatalogStatus: (id: string, active: boolean, reason: string) => Promise<void>;
    deleteCatalogItem: (id: string) => Promise<void>;
  };

const CatalogCtx = createContext<CatalogCtxType>({
  catalog: [],
  loading: false,
  error: null,
  refresh: async () => { },
  saveCatalogItem: async () => null,
  updateCatalogStatus: async () => { },
  deleteCatalogItem: async () => { },
});

const API = "api/productcataloggravureShrink";

export function ProductCatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<GravureProductCatalog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiReady = true;
  const { showToast } = useToast();

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await apiGet<ApiCatalogRow[]>(`${API}/getcataloglist`);
      if (!Array.isArray(rows)) {
        setError("Catalog API returned unexpected data format. Please refresh.");
        console.error("[Catalog] expected array, got:", typeof rows, rows);
        return;
      }
      const mapped: GravureProductCatalog[] = [];
      for (let i = 0; i < rows.length; i++) {
        try {
          mapped.push(mapApiRow(rows[i]));
        } catch (mapErr: any) {
          console.error("[Catalog] mapApiRow failed on row", i, mapErr);
        }
      }
      setCatalog(mapped);
    } catch (e: any) {
      setError(e?.message ?? "API unavailable — please login and ensure backend is running.");
      console.warn("[Catalog] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  const isDbGuid = (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
    /^\d+$/.test(id);

  const saveCatalogItem = async (item: GravureProductCatalog): Promise<string | null> => {
    // Update local state immediately (optimistic)
    setCatalog(prev => {
      const exists = prev.find(c => c.id === item.id);
      return exists ? prev.map(c => c.id === item.id ? item : c) : [...prev, item];
    });

    if (apiReady) {
      const payload = {
        ProductMasterID: item.id,
        ProductMasterCode: item.catalogNo || "",
        DraftCatalogCode: item.catalogNo || "",
        ProductName: item.productName,
        CustomerID: item.customerId,
        CategoryID: item.categoryId,
        Content: item.content,
        JobWidth: item.jobWidth,
        JobHeight: item.jobHeight,
        ActualWidth: item.actualWidth,
        ActualHeight: item.actualHeight,
        NoOfColors: item.noOfColors,
        FrontColors: item.frontColors,
        BackColors: item.backColors,
        PrintType: item.printType,
        Substrate: item.substrate,
        MachineID: item.machineId,
        MachineName: item.machineName,
        CylinderCostPerColor: item.cylinderCostPerColor,
        OverheadPct: item.overheadPct,
        ProfitPct: item.profitPct,
        PerMeterRate: item.perMeterRate,
        StructureType: item.structureType,
        TrimmingSize: item.trimmingSize ?? 0,
        WidthShrinkage: item.widthShrinkage ?? 0,
        GussetSize: item.gussetSize ?? 0,
        SeamingArea: item.seamingArea ?? 0,
        TransparentArea: item.transparentArea ?? 0,
        Gusset: item.gusset ?? 0,
        SealSize: item.sealSize ?? 0,
        HasZipper: item.hasZipper ? 1 : 0,
        HasSpout: item.hasSpout ? 1 : 0,
        HasValve: item.hasValve ? 1 : 0,
        LaminationPlies: item.laminationPlies ?? 0,
        ZipperWeight: item.zipperWeight ?? 0,
        SpoutWeight: item.spoutWeight ?? 0,
        TopSeal: item.topSeal ?? 0,
        BottomSeal: item.bottomSeal ?? 0,
        SideSeal: item.sideSeal ?? 0,
        CenterSealWidth: item.centerSealWidth ?? 0,
        SideGusset: item.sideGusset ?? 0,
        RepeatLength: item.repeatLength ?? 0,
        RepeatShrinkage: item.repeatShrinkage ?? 0,
        PackWidth: item.packWidth ?? 0,
        PackHeight: item.packHeight ?? 0,
        HMargin: item.hMargin ?? 0,
        VMargin: item.vMargin ?? 0,
        AcrossUPS: item.acrossUPS ?? 0,
        VerticalUPS: item.verticalUPS ?? 0,
        PrintedLength: item.printedLength ?? 0,
        EyeMarkLength: item.eyeMarkLength ?? 0,
        GapLength: item.gapLength ?? 0,
        UnwindDirection: item.unwindDirection ?? 0,
        FinalRollOD: item.finalRollOD ?? 0,
        RollQtyUnit: item.rollQtyUnit ?? "Meter",
        PackSize: item.packSize ?? "",
        BrandName: item.brandName ?? "",
        ProductType: item.productType ?? "",
        SkuType: item.skuType ?? "",
        BottleType: item.bottleType ?? "",
        AddressType: item.addressType ?? "",
        SpecialSpecs: item.specialSpecs ?? "",
        ArtworkName: item.artworkName ?? "",
        SourceEstimationID: item.sourceEstimationId,
        SourceEstimationNo: item.sourceEstimationNo,
        SourceOrderID: item.sourceOrderId,
        SourceOrderNo: item.sourceOrderNo,
        SourceWorkOrderID: item.sourceWorkOrderId,
        SourceWorkOrderNo: item.sourceWorkOrderNo,
        StandardQty: item.standardQty,
        StandardUnit: item.standardUnit,
        Remarks: item.remarks,
        SavedPlanID: item.savedPlanId ?? "",
        SavedPlan: JSON.stringify(item.savedPlan || null),
        SavedColorShades: JSON.stringify(item.savedColorShades ?? []),
        SavedCylAllocs: JSON.stringify(item.savedCylAllocs ?? []),
        AttachmentsCloudinary: JSON.stringify(item.attachmentsCloudinary ?? []),
        ExistingAttachmentIDs: JSON.stringify(item.existingAttachmentIDs ?? []),
        // Explicit SavedLayersJSON so backend stores all consumables (not a truncated FOR JSON PATH)
        SavedLayersJSON: JSON.stringify((item.secondaryLayers ?? []).map((l: any, li: number) => ({
          layerNo: l.layerNo || li + 1,
          itemId: l.ItemID ?? l.itemId ?? "",
          itemName: l.itemName ?? l.ItemName ?? "",
          itemSubGroup: l.itemSubGroup ?? l.ItemSubGroup ?? "",
          plyType: l.PlyType ?? l.plyType ?? "Film",
          gsm: l.FilmGSM ?? l.filmGSM ?? l.gsm ?? 0,
          filmGSM: l.FilmGSM ?? l.filmGSM ?? l.gsm ?? 0,
          filmRate: l.FilmRate ?? l.filmRate ?? l.rate ?? 0,
          density: l.density ?? 0,
          thickness: l.thickness ?? 0,
          storedSubGroup: l.itemSubGroup ?? l.ItemSubGroup ?? "",
          consumableItems: (l.Consumables ?? l.consumables ?? l.consumableItems ?? []).map((c: any) => ({
            consumableId: c.consumableId ?? c.ConsumableID ?? "",
            consumableType: c.consumableType ?? c.itemGroup ?? "",
            itemId: c.itemId ?? "",
            itemGroupId: c.itemGroupId ?? "",
            itemGroupName: c.itemGroupName ?? c.itemGroup ?? "",
            itemSubGroupId: c.itemSubGroupId ?? "",
            itemSubGroupName: c.itemSubGroupName ?? c.itemSubGroup ?? "",
            itemName: c.itemName ?? "",
            dryGSM: c.dryGSM ?? c.gsm ?? 0,
            gsm: c.dryGSM ?? c.gsm ?? 0,
            solidPercentage: c.solidPercentage ?? c.solidPct ?? 0,
            solidPct: c.solidPercentage ?? c.solidPct ?? 0,
            liquidGSM: c.liquidGSM ?? 0,
            ratioPct: c.ratioPct ?? 0,
            itemGroup: c.itemGroup ?? c.consumableType ?? c.itemGroupName ?? "",
            itemSubGroup: c.itemSubGroup ?? c.itemSubGroupName ?? "",
          })),
        }))),
        SecondaryLayers: (item.secondaryLayers ?? []).map((l: any, li: number) => ({
          layerNo: l.layerNo || li + 1,
          itemId: l.ItemID ?? l.itemId ?? "",
          itemName: l.itemName ?? l.ItemName ?? "",
          itemSubGroup: l.itemSubGroup ?? l.ItemSubGroup ?? "",
          plyType: l.PlyType ?? l.plyType ?? "Film",
          filmGSM: l.FilmGSM ?? l.filmGSM ?? l.gsm ?? 0,
          filmRate: l.FilmRate ?? l.filmRate ?? l.rate ?? 0,
          Consumables: (l.Consumables ?? l.consumables ?? l.consumableItems ?? []).map((c: any) => ({
            consumableType: c.consumableType ?? c.itemGroup ?? "",
            itemId: c.itemId ?? "",
            itemGroupId: c.itemGroupId ?? "",
            itemGroupName: c.itemGroupName ?? c.itemGroup ?? "",
            itemSubGroupId: c.itemSubGroupId ?? "",
            itemSubGroupName: c.itemSubGroupName ?? c.itemSubGroup ?? "",
            itemName: c.itemName ?? "",
            dryGSM: c.dryGSM ?? c.gsm ?? 0,
            solidPercentage: c.solidPercentage ?? c.solidPct ?? 0,
            liquidGSM: c.liquidGSM ?? 0,
            ratioPct: c.ratioPct ?? 0,
          })),
        })),
        Processes: (() => {
          const all = item.processes ?? [];
          const valid = all.filter((p: any) => {
            const id = String(p.id ?? p.processId ?? "");
            return /^\d+$/.test(id) && parseInt(id, 10) > 0;
          }).map((p: any) => ({
            processId: parseInt(String(p.id ?? p.processId), 10),
            rate: p.rate ?? 0,
            qty: p.qty ?? p.quantity ?? 0,
            amount: p.amount ?? 0,
          }));
          if (all.length > 0 && valid.length === 0) {
            console.warn("[Catalog] All processes filtered out — non-numeric IDs. Raw:", all);
          }
          if (valid.length > 0) {
            console.log("[Catalog] Sending processes:", valid);
          }
          return valid;
        })(),
      };
      const endpoint = isDbGuid(item.id ?? "")
        ? `${API}/updatecatalogdata`
        : `${API}/savecatalogdata`;
      try {
        const resp = await apiPost<any>(endpoint, payload);
        const r = Array.isArray(resp) ? resp[0] : resp;
        if (r?.Status === "fail" || r?.status === "fail") {
          showToast("error", "Save Failed", r.Message || r.message || "Unknown error");
          return null;
        }
        if (r?.ProductMasterID) {
          if (!isDbGuid(item.id ?? "")) {
            setCatalog(prev => prev.map(c =>
              c.id === item.id ? { ...c, id: r.ProductMasterID, catalogNo: r.ProductMasterCode || c.catalogNo } : c
            ));
          }
          showToast("success", "Catalog Saved", `Product "${item.productName}" saved successfully.`);
          return r.ProductMasterID as string;
        }
        // Response received but no ProductMasterID — log for debugging
        console.warn("Catalog save response missing ProductMasterID:", r);
        showToast("warning", "Save Incomplete", "Record may not have saved correctly — no ID returned.");
      } catch (err: any) {
        showToast("error", "Save Error", err?.message ?? String(err));
      }
      return isDbGuid(item.id ?? "") ? item.id : null;
    }
    return null;
  };

  const deleteCatalogItem = useCallback(async (id: string) => {
    // Optimistic local remove
    setCatalog(prev => prev.filter(c => c.id !== id));
    if (apiReady) {
      try {
        await apiGet(`${API}/deletecatalogdata/${id}`);
        showToast("success", "Catalog Deleted", "Entry removed successfully.");
      } catch (err: any) {
        showToast("error", "Delete Failed", err.message || "Failed to delete catalog");
        await fetchCatalog();
      }
    }
  }, [showToast, fetchCatalog]);

  const updateCatalogStatus = useCallback(async (id: string, active: boolean, reason: string) => {
    try {
      const res = await apiPost<any>(`${API}/updatestatus`, {
        ProductMasterID: id,
        IsActive: active ? 0 : 1,
        Reason: reason
      });
      const r = Array.isArray(res) ? res[0] : res;
      if (r?.Status === "success") {
        showToast("success", "Status Updated", `Catalog ${active ? "activated" : "deactivated"} successfully`);
        await fetchCatalog();
      } else {
        throw new Error(r?.Message || "API returned failure");
      }
    } catch (err: any) {
      showToast("error", "Update Failed", err.message || "Failed to update status");
    }
  }, [showToast, fetchCatalog]);

  return (
    <CatalogCtx.Provider value={{
      catalog, loading, error, refresh: fetchCatalog,
      saveCatalogItem, deleteCatalogItem, updateCatalogStatus
    }}>
      {children}
    </CatalogCtx.Provider>
  );
}

export const useProductCatalog = () => useContext(CatalogCtx);
