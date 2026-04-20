import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { WORKFLOWS, type WorkflowKey } from "@/lib/workflows";
import { WorkflowTimeline } from "./WorkflowTimeline";
import { WorkflowStageDetail } from "./WorkflowStageDetail";
import type { StageRow, StepRow, PersonNameLookup } from "./types";

interface Props {
  ticketId: string;
  workflowKey: WorkflowKey;
  currentStageKey: string | null;
  refreshKey: number;
  onChanged: () => void;
  personName: PersonNameLookup;
  onStepStatusMap?: (m: Record<string, "pending" | "complete" | "skipped">) => void;
}

export function WorkflowSection({
  ticketId,
  workflowKey,
  currentStageKey,
  refreshKey,
  onChanged,
  personName,
  onStepStatusMap,
}: Props) {
  const [stages, setStages] = useState<StageRow[]>([]);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStageKey, setSelectedStageKey] = useState<string | null>(currentStageKey);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [sRes, stRes] = await Promise.all([
        supabase
          .from("ticket_workflow_stages")
          .select("*")
          .eq("ticket_id", ticketId)
          .order("order_index", { ascending: true }),
        supabase
          .from("ticket_workflow_steps")
          .select("*")
          .eq("ticket_id", ticketId)
          .order("order_index", { ascending: true }),
      ]);
      if (cancelled) return;
      setStages((sRes.data ?? []) as StageRow[]);
      setSteps((stRes.data ?? []) as StepRow[]);
      if (onStepStatusMap) {
        const m: Record<string, "pending" | "complete" | "skipped"> = {};
        for (const st of (stRes.data ?? []) as StepRow[]) m[st.step_key] = st.status;
        onStepStatusMap(m);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ticketId, refreshKey]);

  // Sync selection to current when current changes (e.g. after advance).
  useEffect(() => {
    setSelectedStageKey(currentStageKey ?? stages.find((s) => s.status !== "pending")?.stage_key ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStageKey, refreshKey]);

  const workflowDef = WORKFLOWS[workflowKey];
  const stageDescriptionMap = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    workflowDef?.stages.forEach((s) => {
      map[s.key] = s.description;
    });
    return map;
  }, [workflowDef]);

  const selectedStage = stages.find((s) => s.stage_key === selectedStageKey) ?? null;
  const selectedSteps = selectedStage
    ? steps.filter((s) => s.stage_key === selectedStage.stage_key)
    : [];
  const currentIndex = stages.findIndex((s) => s.stage_key === currentStageKey);
  const isViewingCurrent =
    selectedStage && currentStageKey && selectedStage.stage_key === currentStageKey;
  const nextStage =
    isViewingCurrent && currentIndex >= 0 && currentIndex < stages.length - 1
      ? stages[currentIndex + 1]
      : null;

  if (loading) {
    return <div className="h-72 bg-muted/40 animate-pulse rounded-sm" />;
  }
  if (stages.length === 0) {
    return (
      <div className="border hairline rounded-sm bg-card p-6 text-sm text-muted-foreground">
        No workflow data found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.3fr)] gap-5">
      <div className="border hairline rounded-sm bg-card p-3">
        <div className="label-eyebrow text-true-taupe px-2 py-1.5">
          {workflowDef?.label ?? workflowKey}
        </div>
        <WorkflowTimeline
          stages={stages}
          steps={steps}
          selectedStageKey={selectedStageKey}
          onSelectStage={setSelectedStageKey}
        />
      </div>

      {selectedStage ? (
        <WorkflowStageDetail
          ticketId={ticketId}
          stage={selectedStage}
          steps={selectedSteps}
          nextStage={nextStage}
          isCurrent={Boolean(isViewingCurrent)}
          onChanged={onChanged}
          onBackToCurrent={() => setSelectedStageKey(currentStageKey)}
          personName={personName}
          stageDescription={stageDescriptionMap[selectedStage.stage_key]}
        />
      ) : currentStageKey == null ? (
        <div className="border hairline rounded-sm bg-card p-6 text-sm text-muted-foreground">
          Workflow complete. Select a stage in the timeline to view its history.
        </div>
      ) : (
        <div className="border hairline rounded-sm bg-card p-6 text-sm text-muted-foreground">
          Select a stage from the timeline.
        </div>
      )}
    </div>
  );
}