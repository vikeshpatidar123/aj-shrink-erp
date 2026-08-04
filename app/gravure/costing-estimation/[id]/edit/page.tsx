"use client";
import { useParams } from "next/navigation";
import CostingEstimationWorkspace from "@/components/gravure/costing-estimation/CostingEstimationWorkspace";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <CostingEstimationWorkspace mode="edit" estimationId={id} />;
}
