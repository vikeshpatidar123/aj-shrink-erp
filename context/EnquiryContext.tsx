"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import { enquiries, gravureEnquiries, Enquiry, GravureEnquiry, SecondaryLayer } from "@/data/dummyData";

// ─── Shared CombinedEnquiry type ─────────────────────────────
export type CombinedEnquiry = {
  id: string; enquiryNo: string; date: string;
  businessUnit: "Extrusion" | "Gravure";
  customerId: string; customerName: string;
  jobName: string; quantity: number; uom: string;
  status: "Pending" | "Estimated" | "Converted" | "Rejected";
  remarks: string;
  salesPersonId: string; salesPersonName: string; salesType: string; concernPerson: string;
  // Extrusion
  productId: string; productName: string;
  width: number; thickness: number;
  printingRequired: boolean; printingColors: number;
  // Gravure
  substrate: string; repeatLength: number; noOfColors: number;
  printType: string; structureType: string;
  cylinderStatus: string; designRef: string; specialFinish: string;
  // Category & Content
  categoryId: string; categoryName: string; selectedContent: string;
  // Plan Window Details
  planHeight?: number; planWidth?: number;
  frontColors?: number; backColors?: number;
  wastageType?: string; finishedFormat?: string; labelRoll?: number;
  // Allocation
  processes?: string[];
  plys?: { id: string; itemQuality: string; thickness: number; gsm: number; mil: number }[];
  secondaryLayers?: SecondaryLayer[];
};

// ─── Converters from static dummyData ────────────────────────
const fromExt = (e: Enquiry): CombinedEnquiry => ({
  id: e.id, enquiryNo: e.enquiryNo, date: e.date, businessUnit: "Extrusion",
  customerId: e.customerId, customerName: e.customerName,
  jobName: e.productName, quantity: e.quantity, uom: e.unit,
  status: e.status, remarks: e.remarks,
  productId: e.productId, productName: e.productName,
  width: e.width, thickness: e.thickness,
  printingRequired: e.printingRequired, printingColors: e.printingColors,
  substrate: "", repeatLength: 0, noOfColors: 0, printType: "",
  structureType: "", cylinderStatus: "", designRef: "", specialFinish: "",
  categoryId: "", categoryName: "", selectedContent: "",
  salesPersonId: "", salesPersonName: "", salesType: "Domestic", concernPerson: "",
});

const fromGrv = (e: GravureEnquiry): CombinedEnquiry => ({
  id: e.id, enquiryNo: e.enquiryNo, date: e.date, businessUnit: "Gravure",
  customerId: e.customerId, customerName: e.customerName,
  jobName: e.jobName, quantity: e.quantity, uom: e.unit,
  status: e.status, remarks: e.remarks,
  substrate: e.substrate, repeatLength: e.repeatLength,
  noOfColors: e.noOfColors, printType: e.printType,
  structureType: e.structureType, cylinderStatus: e.cylinderStatus,
  designRef: e.designRef, specialFinish: e.specialFinish,
  productId: "", productName: "", width: 0, thickness: 0,
  printingRequired: false, printingColors: 0,
  categoryId: "", categoryName: "", selectedContent: "",
  salesPersonId: "", salesPersonName: "", salesType: "Domestic", concernPerson: "",
});

// ─── Rich planning patches for gravure dummy enquiries ───────
// Process names must match processMasters[].name exactly (filtered by module="Rotogravure")
const GRV_PATCHES: Record<string, Partial<CombinedEnquiry>> = {
  GE001: {
    categoryId: "CAT001", categoryName: "Roto - Label", selectedContent: "BOPP Label",
    planHeight: 450, planWidth: 340, frontColors: 4, backColors: 4,
    wastageType: "Machine Default", finishedFormat: "Roll Form", labelRoll: 5000,
    salesPersonName: "Rajesh Sharma", salesType: "Domestic", concernPerson: "Suresh Kumar",
    processes: ["8-Color Roto Printing", "Slitting & Rewinding"],
    plys: [
      { id: "P1A", itemQuality: "film", thickness: 20, gsm: 18.9, mil: 0.8 },
      { id: "P1B", itemQuality: "ink",  thickness: 0,  gsm: 3.5,  mil: 0   },
    ],
  },
  GE002: {
    categoryId: "CAT002", categoryName: "Pouch", selectedContent: "3-Side Seal",
    planHeight: 400, planWidth: 420, frontColors: 3, backColors: 3,
    wastageType: "Machine Default", finishedFormat: "Pouch Form", labelRoll: 0,
    salesPersonName: "Sanjay Gupta", salesType: "Domestic", concernPerson: "Priya Mehta",
    processes: ["6-Color Roto Printing", "Dry Bond Lamination", "3-Side Seal Pouch Making", "Slitting & Rewinding"],
    plys: [
      { id: "P2A", itemQuality: "film",     thickness: 12, gsm: 16.8, mil: 0.5 },
      { id: "P2B", itemQuality: "ink",      thickness: 0,  gsm: 3.5,  mil: 0   },
      { id: "P2C", itemQuality: "adhesive", thickness: 0,  gsm: 4.0,  mil: 0   },
    ],
  },
  GE003: {
    categoryId: "CAT002", categoryName: "Pouch", selectedContent: "Standup Pouch",
    planHeight: 480, planWidth: 380, frontColors: 5, backColors: 4,
    wastageType: "Manual", finishedFormat: "Pouch Form", labelRoll: 0,
    salesPersonName: "Anita Desai", salesType: "Domestic", concernPerson: "Ramesh Patel",
    processes: ["9-Color Roto Printing", "Dry Bond Lamination", "Stand-up Pouch (SUP)", "Slitting & Rewinding"],
    plys: [
      { id: "P3A", itemQuality: "film",     thickness: 20, gsm: 18.9, mil: 0.8 },
      { id: "P3B", itemQuality: "ink",      thickness: 0,  gsm: 3.5,  mil: 0   },
      { id: "P3C", itemQuality: "film",     thickness: 12, gsm: 16.8, mil: 0.5 },
      { id: "P3D", itemQuality: "adhesive", thickness: 0,  gsm: 4.0,  mil: 0   },
    ],
  },
  GE004: {
    categoryId: "CAT001", categoryName: "Roto - Label", selectedContent: "Shrink Sleeve",
    planHeight: 360, planWidth: 260, frontColors: 3, backColors: 3,
    wastageType: "Machine Default", finishedFormat: "Roll Form", labelRoll: 8000,
    salesPersonName: "Rajesh Sharma", salesType: "Domestic", concernPerson: "Amit Joshi",
    processes: ["Cylinder Engraving", "Cylinder Chrome Plating", "6-Color Roto Printing", "Slitting & Rewinding"],
    plys: [
      { id: "P4A", itemQuality: "film", thickness: 50, gsm: 65, mil: 2.0 },
    ],
  },
  GE005: {
    categoryId: "CAT001", categoryName: "Roto - Label", selectedContent: "BOPP Label",
    planHeight: 390, planWidth: 300, frontColors: 4, backColors: 4,
    wastageType: "Machine Default", finishedFormat: "Roll Form", labelRoll: 5000,
    salesPersonName: "Sanjay Gupta", salesType: "Domestic", concernPerson: "Deepak Singh",
    processes: ["8-Color Roto Printing", "Matte OPV Coating", "Slitting & Rewinding"],
    plys: [
      { id: "P5A", itemQuality: "film", thickness: 20, gsm: 18.9, mil: 0.8 },
      { id: "P5B", itemQuality: "ink",  thickness: 0,  gsm: 3.5,  mil: 0   },
    ],
  },
};

const initData: CombinedEnquiry[] = [
  ...enquiries.map(fromExt),
  ...gravureEnquiries.map(e => ({ ...fromGrv(e), ...(GRV_PATCHES[e.id] || {}) })),
];

// ─── Context ──────────────────────────────────────────────────
type EnquiryCtxType = {
  enquiries: CombinedEnquiry[];
  saveEnquiry: (eq: CombinedEnquiry) => void;
  deleteEnquiry: (id: string) => void;
};

const EnquiryCtx = createContext<EnquiryCtxType>({
  enquiries: initData,
  saveEnquiry: () => {},
  deleteEnquiry: () => {},
});

export function EnquiryProvider({ children }: { children: ReactNode }) {
  const [enquiriesState, setEnquiries] = useState<CombinedEnquiry[]>(initData);

  const saveEnquiry = (eq: CombinedEnquiry) => {
    setEnquiries(prev => {
      const exists = prev.find(e => e.id === eq.id);
      return exists ? prev.map(e => e.id === eq.id ? eq : e) : [...prev, eq];
    });
  };

  const deleteEnquiry = (id: string) => {
    setEnquiries(prev => prev.filter(e => e.id !== id));
  };

  return (
    <EnquiryCtx.Provider value={{ enquiries: enquiriesState, saveEnquiry, deleteEnquiry }}>
      {children}
    </EnquiryCtx.Provider>
  );
}

export const useEnquiries = () => useContext(EnquiryCtx);
