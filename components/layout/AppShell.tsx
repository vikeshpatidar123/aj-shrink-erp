"use client";
import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { usePathname } from "next/navigation";
import { UnitProvider } from "@/context/UnitContext";
import { CategoriesProvider } from "@/context/CategoriesContext";
import { EnquiryProvider } from "@/context/EnquiryContext";
import { ProductCatalogProvider } from "@/context/ProductCatalogContext";
import { ExtrusionCatalogProvider } from "@/context/ExtrusionCatalogContext";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/masters/customers": "Customer Master",
  "/masters/products": "Product Master",
  "/masters/items": "Item Master",
  "/masters/rolls": "Roll Master",
  "/masters/recipes": "Recipe Master",
  "/masters/processes": "Process Master",
  "/masters/hsn": "HSN Master",
  "/masters/subgroups": "SubGroup Master",
  "/masters/machines": "Machine Master",
  "/masters/units": "Unit Master",
  "/masters/employees": "Employee Master",
  "/enquiry": "Enquiry Management",
  "/cost-estimation": "Cost Estimation & Planning",
  "/gravure/estimation": "Gravure Estimation",
  "/gravure/product-catalog": "Gravure Product Catalog",
  "/extrusion/product-catalog": "Extrusion Product Catalog",
  "/extrusion/workorder": "Extrusion Work Order",
  "/gravure/orders": "Gravure Order Booking",
  "/orders": "Order Booking",
  "/jobcard": "Job Card",
  "/gravure/workorder": "Gravure Work Order",
  "/production": "Production Entry",
  "/gravure/production": "Gravure Production",
  "/dispatch": "Dispatch",
  "/tool-inventory/stock-summary":         "Tool Stock Summary",
  "/tool-inventory/purchase-requisition":  "Tool Purchase Requisition",
  "/tool-inventory/purchase-order":        "Tool Purchase Order",
  "/tool-inventory/tool-receipt":          "Tool Receipt",
  "/tool-inventory/tool-issue":            "Tool Issue",
  "/tool-inventory/tool-return":           "Tool Return",
  "/tool-inventory/tool-transfer":         "Tool Transfer",
  "/tool-inventory/physical-verification": "Tool Physical Verification",
};

const AUTH_PATHS = ["/login", "/login/user"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen]   = useState(false);   // mobile overlay
  const [desktopOpen, setDesktopOpen] = useState(true);    // desktop in-layout

  const pathname = usePathname();
  const title    = pageTitles[pathname] || "AJ Shrink ERP";

  if (AUTH_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  const handleMenuClick = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileOpen(o => !o);   // mobile: overlay drawer
    } else {
      setDesktopOpen(o => !o);  // desktop: push layout
    }
  };

  return (
    <ExtrusionCatalogProvider>
    <ProductCatalogProvider>
    <EnquiryProvider>
    <CategoriesProvider>
    <UnitProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>
        <Sidebar
          mobileOpen={mobileOpen}
          desktopOpen={desktopOpen}
          onClose={() => setMobileOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar onMenuClick={handleMenuClick} title={title} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-7">{children}</main>
        </div>
      </div>
    </UnitProvider>
    </CategoriesProvider>
    </EnquiryProvider>
    </ProductCatalogProvider>
    </ExtrusionCatalogProvider>
  );
}
