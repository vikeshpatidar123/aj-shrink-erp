"use client";
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { apiGet, apiGetSafe, apiPost } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { SecondaryLayer } from "@/data/dummyData";

export type ProcessRef = { id: string; name: string };

export type CombinedEnquiry = {
  id: string; enquiryNo: string; date: string;
  businessUnit: "Extrusion" | "Gravure";
  customerId: string; customerName: string;
  jobName: string; quantity: number; uom: string;
  status: "Pending" | "Estimated" | "Converted" | "Rejected";
  remarks: string;
  salesPersonId: string; salesPersonName: string; salesType: string; concernPerson: string;
  // Extrusion fields
  productId: string; productName: string;
  width: number; thickness: number;
  printingRequired: boolean; printingColors: number;
  // Gravure fields
  substrate: string; repeatLength: number; noOfColors: number;
  printType: string; structureType: string;
  cylinderStatus: string; designRef: string; specialFinish: string;
  // Category & Content
  categoryId: string; categoryName: string; selectedContent: string;
  // Plan Window Details
  planHeight?: number; planWidth?: number;
  frontColors?: number; backColors?: number;
  wastageType?: string; finishedFormat?: string; labelRoll?: number;
  // Dimension detail (from DimensionInputPanel)
  topSeal?: number; bottomSeal?: number; sideSeal?: number; centerSeal?: number;
  gusset?: number; sideGusset?: number; sealWidth?: number;
  seamingArea?: number; transparentArea?: number;
  // Allocation
  processes?: ProcessRef[];
  plys?: { id: string; itemQuality: string; thickness: number; gsm: number; mil: number }[];
  secondaryLayers?: SecondaryLayer[];
};

// ─── Map API row → CombinedEnquiry ────────────────────────
const mapRow = (r: Record<string, unknown>): CombinedEnquiry => ({
  id: String(r.EnquiryID ?? ""),
  enquiryNo: String(r.EnquiryNo ?? ""),
  date: String(r.EnquiryDate ?? "").slice(0, 10),
  businessUnit: "Gravure",
  customerId: String(r.LedgerID ?? ""),
  customerName: String(r.CustomerName ?? ""),
  jobName: String(r.JobName ?? ""),
  quantity: parseFloat(String(r.Quantity ?? "0")) || 0,
  uom: String(r.EstimationUnit ?? "Meter"),
  status: (String(r.Status ?? "Pending")) as CombinedEnquiry["status"],
  remarks: String(r.Remark ?? ""),
  salesPersonId: String(r.SalesEmployeeID ?? ""),
  salesPersonName: String(r.SalesPersonName ?? ""),
  salesType: String(r.SalesType ?? "Domestic"),
  concernPerson: String(r.GrvConcernPerson ?? ""),
  categoryId: r.CategoryID ? String(r.CategoryID) : "",
  categoryName: String(r.CategoryName ?? ""),
  selectedContent: String(r.GrvSelectedContent ?? ""),
  substrate: String(r.GrvSubstrate ?? ""),
  repeatLength: parseFloat(String(r.GrvRepeatLength ?? "0")) || 0,
  noOfColors: parseInt(String(r.GrvNoOfColors ?? "0")) || 0,
  printType: String(r.GrvPrintType ?? "Surface Print"),
  structureType: String(r.GrvStructureType ?? ""),
  cylinderStatus: String(r.GrvCylinderStatus ?? "New"),
  designRef: String(r.DesignRef ?? ""),
  specialFinish: String(r.GrvSpecialFinish ?? "None"),
  planHeight: parseFloat(String(r.GrvPlanHeight ?? "0")) || 0,
  planWidth: parseFloat(String(r.GrvPlanWidth ?? "0")) || 0,
  frontColors: parseInt(String(r.GrvFrontColors ?? "0")) || 0,
  backColors: parseInt(String(r.GrvBackColors ?? "0")) || 0,
  wastageType: String(r.GrvWastageType ?? "Machine Default"),
  finishedFormat: String(r.GrvFinishedFormat ?? "Roll Form"),
  labelRoll: parseInt(String(r.GrvLabelRoll ?? "0")) || 0,
  topSeal: parseFloat(String(r.GrvTopSeal ?? "0")) || 0,
  bottomSeal: parseFloat(String(r.GrvBottomSeal ?? "0")) || 0,
  sideSeal: parseFloat(String(r.GrvSideSeal ?? "0")) || 0,
  centerSeal: parseFloat(String(r.GrvCenterSeal ?? "0")) || 0,
  gusset: parseFloat(String(r.GrvGusset ?? "0")) || 0,
  sideGusset: parseFloat(String(r.GrvSideGusset ?? "0")) || 0,
  sealWidth: parseFloat(String(r.GrvSealWidth ?? "0")) || 0,
  seamingArea: parseFloat(String(r.GrvSeamingArea ?? "0")) || 0,
  transparentArea: parseFloat(String(r.GrvTransparentArea ?? "0")) || 0,
  productId: "", productName: "", width: 0, thickness: 0,
  printingRequired: false, printingColors: 0,
  processes: [],
  plys: [],
  secondaryLayers: [],
});

// ─── Context type ─────────────────────────────────────────
type EnquiryCtxType = {
  enquiries: CombinedEnquiry[];
  loading: boolean;
  saveEnquiry: (eq: CombinedEnquiry) => Promise<void>;
  deleteEnquiry: (id: string) => Promise<void>;
  refreshEnquiries: () => Promise<void>;
};

const EnquiryCtx = createContext<EnquiryCtxType>({
  enquiries: [],
  loading: false,
  saveEnquiry: async () => {},
  deleteEnquiry: async () => {},
  refreshEnquiries: async () => {},
});

// ─── Build save payload ───────────────────────────────────
function buildPayload(eq: CombinedEnquiry) {
  return {
    Date: eq.date,
    CustomerID: eq.customerId,
    JobName: eq.jobName,
    Quantity: String(eq.quantity),
    Unit: eq.uom,
    Remarks: eq.remarks,
    Status: eq.status,
    SalesPersonID: eq.salesPersonId,
    SalesType: eq.salesType,
    ConcernPerson: eq.concernPerson,
    CategoryID: eq.categoryId,
    SelectedContent: eq.selectedContent,
    GrvSubstrate: eq.substrate,
    GrvCylinderStatus: eq.cylinderStatus,
    GrvSpecialFinish: eq.specialFinish,
    GrvNoOfColors: eq.noOfColors,
    GrvWidth: eq.width,
    GrvRepeatLength: eq.repeatLength,
    GrvStructureType: eq.structureType,
    GrvPrintType: eq.printType,
    DesignRef: eq.designRef,
    PlanHeight: eq.planHeight ?? 0,
    PlanWidth: eq.planWidth ?? 0,
    FrontColors: eq.frontColors ?? 0,
    BackColors: eq.backColors ?? 0,
    WastageType: eq.wastageType ?? "Machine Default",
    FinishedFormat: eq.finishedFormat ?? "Roll Form",
    LabelRoll: eq.labelRoll ?? 0,
    TopSeal: eq.topSeal ?? 0,
    BottomSeal: eq.bottomSeal ?? 0,
    SideSeal: eq.sideSeal ?? 0,
    CenterSeal: eq.centerSeal ?? 0,
    Gusset: eq.gusset ?? 0,
    SideGusset: eq.sideGusset ?? 0,
    SealWidth: eq.sealWidth ?? 0,
    SeamingArea: eq.seamingArea ?? 0,
    TransparentArea: eq.transparentArea ?? 0,
    Processes: (eq.processes ?? []).map(p => ({ ProcessID: p.id, ProcessName: p.name })),
    Plys: (eq.secondaryLayers ?? []).map((l, idx) => ({
      LayerNo: idx + 1,
      PlyType: l.plyType,
      FilmSubGroup: l.itemSubGroup,
      Density: l.density,
      Thickness: l.thickness,
      FilmGSM: l.gsm,
      ItemID: l.itemId || "",
      ItemName: l.itemName || "",
      Consumables: l.consumableItems.map(ci => ({
        ItemGroup: ci.itemGroup,
        ItemSubGroup: ci.itemSubGroup,
        ItemID: ci.itemId,
        ItemName: ci.itemName,
        FieldDisplayName: ci.fieldDisplayName,
        GSM: ci.gsm,
        Rate: ci.rate,
        CoveragePct: ci.coveragePct ?? 100,
        SolidPct: ci.solidPct ?? null,
        OhPct: ci.ohPct ?? null,
        NcoPct: ci.ncoPct ?? null,
      })),
    })),
  };
}

// ─── Provider ─────────────────────────────────────────────
export function EnquiryProvider({ children }: { children: ReactNode }) {
  const [enquiriesState, setEnquiries] = useState<CombinedEnquiry[]>([]);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const refreshEnquiries = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGetSafe<Record<string, unknown>[]>("api/gravureEnquiryShrink/getenquirylist");
      setEnquiries(Array.isArray(data) ? data.map(mapRow) : []);
    } catch (err) {
      showToast("error", "Load Error", String(err));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { refreshEnquiries(); }, [refreshEnquiries]);

  const saveEnquiry = async (eq: CombinedEnquiry) => {
    const isNew = !eq.id;
    const payload = buildPayload(eq);
    const endpoint = isNew
      ? "api/gravureEnquiryShrink/saveenquiry"
      : "api/gravureEnquiryShrink/updateenquiry";
    const body = isNew ? payload : { ...payload, EnquiryID: eq.id };

    const res = await apiPost<{ Status: string; Message?: string }>(endpoint, body);
    if (res?.Status !== "success") {
      throw new Error(res?.Message || "Save failed");
    }
    await refreshEnquiries();
  };

  const deleteEnquiry = async (id: string) => {
    const res = await apiGet<{ Status: string; Message?: string }>(
      `api/gravureEnquiryShrink/deleteenquiry/${id}`
    );
    if (res?.Status !== "success") {
      throw new Error(res?.Message || "Delete failed");
    }
    await refreshEnquiries();
  };

  return (
    <EnquiryCtx.Provider value={{ enquiries: enquiriesState, loading, saveEnquiry, deleteEnquiry, refreshEnquiries }}>
      {children}
    </EnquiryCtx.Provider>
  );
}

export const useEnquiries = () => useContext(EnquiryCtx);
