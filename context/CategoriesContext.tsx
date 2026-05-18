"use client";
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { CategoryMaster, categories as initData } from "@/data/dummyData";
import { apiGet } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

type CategoriesCtxType = {
  categories: CategoryMaster[];
  saveCategory: (cat: CategoryMaster) => void;
  deleteCategory: (id: string) => void;
  refresh: () => Promise<void>;
};

const CategoriesCtx = createContext<CategoriesCtxType>({
  categories: initData,
  saveCategory: () => {},
  deleteCategory: () => {},
  refresh: async () => {},
});

// Map DB ItemGroupName → frontend plyType layer name
function toPlyType(itemGroupName: string): string {
  const g = (itemGroupName || "").toLowerCase();
  if (g.includes("ink"))                              return "Printing";
  if (g.includes("adhesive") || g.includes("lamin")) return "Lamination";
  if (g.includes("varnish") || g.includes("opv") || g.includes("coating")) return "Coating";
  if (g.includes("film"))                             return "Film";
  return itemGroupName || "Printing";
}

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<CategoryMaster[]>(initData);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!isLoggedIn()) return;

    try {
      const data = await apiGet<any>("api/productcataloggravureShrink/getcategorieswithcontents");
      if (!data || !Array.isArray(data.categories)) return;

      // Group contents by CategoryID
      const contentMap: Record<string, string[]> = {};
      (data.categoryContents || []).forEach((c: any) => {
        const cid = String(c.CategoryID);
        if (!contentMap[cid]) contentMap[cid] = [];
        if (c.ContentName) contentMap[cid].push(c.ContentName);
      });

      // Group ply configs by CategoryID
      const plyMap: Record<string, any[]> = {};
      (data.plyConfigs || []).forEach((p: any) => {
        const cid = String(p.CategoryID);
        if (!plyMap[cid]) plyMap[cid] = [];
        plyMap[cid].push({
          id:               String(p.PlyConfigID),
          plyType:          toPlyType(p.ItemGroupName),
          fieldDisplayName: p.FieldDisplayName || p.ItemSubGroupName || p.ItemGroupName || "",
          itemGroup:        p.ItemGroupName    || "",
          itemSubGroup:     p.ItemSubGroupName || "",
          defaultValue:     Number(p.DefaultGSM) || 0,
        });
      });

      const mapped: CategoryMaster[] = data.categories.map((c: any) => ({
        id:             String(c.CategoryID),
        name:           c.CategoryName || "",
        status:         "Active",
        contents:       contentMap[String(c.CategoryID)] || [],
        plyConsumables: plyMap[String(c.CategoryID)]    || [],
      }));

      if (mapped.length > 0) setCategories(mapped);
    } catch {
      // Retry after 10 seconds — server may not be ready or user may not be logged in yet
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(() => {
        if (isLoggedIn()) refresh();
      }, 10000);
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => { if (retryRef.current) clearTimeout(retryRef.current); };
  }, [refresh]);

  const saveCategory = (cat: CategoryMaster) => {
    setCategories(prev => {
      const exists = prev.find(c => c.id === cat.id);
      return exists ? prev.map(c => c.id === cat.id ? cat : c) : [...prev, cat];
    });
  };

  const deleteCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  return (
    <CategoriesCtx.Provider value={{ categories, saveCategory, deleteCategory, refresh }}>
      {children}
    </CategoriesCtx.Provider>
  );
}

export const useCategories = () => useContext(CategoriesCtx);
