"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ManagerRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/gravure/artwork-management"); }, [router]);
  return null;
}
