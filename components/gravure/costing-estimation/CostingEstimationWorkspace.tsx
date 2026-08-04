"use client";
/**
 * CostingEstimationWorkspace — top-level owner of the multi-instance array
 * for the Gravure Costing Estimation full-page rewrite (see the approved
 * plan, calm-enchanting-kahan.md). Renders one <EstimationInstancePanel>
 * per instance ("base" record plus any siblings produced via
 * "Clone Estimation"), all wrapped in a single <CostingMastersProvider>
 * so shared master data (machines, processes, film/ink lookups, rate maps)
 * is fetched/derived once regardless of how many instances are on screen.
 *
 * Rendered by the two thin route files:
 *   app/gravure/costing-estimation/new/page.tsx        (mode="new")
 *   app/gravure/costing-estimation/[id]/edit/page.tsx  (mode="edit")
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GravureEstimation } from "@/data/dummyData";
import { CostingMastersProvider } from "@/components/gravure/costing-estimation/CostingMastersContext";
import EstimationInstancePanel from "@/components/gravure/costing-estimation/EstimationInstancePanel";

export interface CostingEstimationWorkspaceProps {
  mode: "new" | "edit";
  estimationId?: string;
}

type InstanceEntry = {
  id: string;
  initialData?: Partial<GravureEstimation>;
  estimationId?: string;
  isCloneChild: boolean;
};

export default function CostingEstimationWorkspace({ mode, estimationId }: CostingEstimationWorkspaceProps) {
  const router = useRouter();

  const [instances, setInstances] = useState<InstanceEntry[]>(() => [
    {
      id: crypto.randomUUID(),
      estimationId: mode === "edit" ? estimationId : undefined,
      isCloneChild: false,
    },
  ]);

  return (
    <CostingMastersProvider>
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 py-5 flex flex-col gap-8">
        {instances.map((inst, idx) => (
          <div key={inst.id} className={inst.isCloneChild ? "relative" : undefined}>
            {inst.isCloneChild && (
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wide bg-purple-100 text-purple-700 border border-purple-200">
                  Estimation {idx + 1} (cloned)
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-purple-200 to-transparent" />
              </div>
            )}
            <div
              className={
                inst.isCloneChild
                  ? "rounded-3xl border-2 border-dashed border-purple-200 bg-purple-50/30 p-3 sm:p-4"
                  : undefined
              }
            >
              <EstimationInstancePanel
                instanceId={inst.id}
                initialData={inst.initialData}
                estimationId={inst.estimationId}
                mode={inst.estimationId ? "edit" : "new"}
                isCloneChild={inst.isCloneChild}
                onRemoveInstance={
                  inst.isCloneChild
                    ? () => setInstances(prev => prev.filter(x => x.id !== inst.id))
                    : undefined
                }
                onSavedNavigateBack={() => router.push("/gravure/costing-estimation")}
                onCloneEstimation={snapshot =>
                  setInstances(prev => [
                    ...prev,
                    { id: crypto.randomUUID(), initialData: snapshot, isCloneChild: true },
                  ])
                }
              />
            </div>
            {idx < instances.length - 1 && (
              <div className="mt-8 border-t-2 border-dashed border-gray-200" />
            )}
          </div>
        ))}
      </div>
    </CostingMastersProvider>
  );
}
