"use client";
import { useState, useEffect } from "react";

export function useCompanyName(fallback = "ERP"): string {
  const [name, setName] = useState(fallback);
  useEffect(() => {
    const stored = localStorage.getItem("companyName");
    if (stored) setName(stored);
  }, []);
  return name;
}

export function getCompanyName(fallback = "ERP"): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem("companyName") || fallback;
}
