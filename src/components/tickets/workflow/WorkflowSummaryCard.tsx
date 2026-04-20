import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { StageRow, StepRow } from "./types";

interface Props {
  ticketId: string;
  refreshKey: number;
}

export function WorkflowSummaryCard({ ticketId, refreshKey }: Props) {
  const [stages, setStages] = useState<StageRow[]>([]);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ticketId, refreshKey]);

  if (loading) {
    return <div className="h-16 bg-muted/40 animate-pulse rounded-sm" />;
  }

  const total = stages.length;
  const current =
    stages.find((s) => s.status === "in_progress") ??
    stages.find((s) => s.status !== "complete" && s.status !== "skipped") ??
    null;
  const currentIndex = current ? stages.findIndex((s) => s.stage_key === current.stage_key) : -1;
  const currentStageSteps = current ? steps.filter((s) => s.stage_key === current.stage_key) : [];
  const completedSteps = currentStageSteps.filter((s) => s.status === "complete" || s.status === "skipped").length;
  const totalSteps = currentStageSteps.length;

  if (!current) {
    return (
      <div>
        <div className="text-sm text-architect">Workflow complete</div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {stages.filter((s) => s.status === "complete").length} of {total} stages done
        </div>
      </div>
    );
  }

  const pct = total > 0 ? ((currentIndex >= 0 ? currentIndex : 0) / total) * 100 : 0;

  return (
    <div>
      <div className="text-sm text-architect truncate">{current.stage_label}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">
        Stage {currentIndex + 1} of {total}
      </div>
      <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-[hsl(var(--gold-deep))] transition-all"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <div className="text-[11px] text-muted-foreground mt-1.5">
        {completedSteps} of {totalSteps} steps done
      </div>
    </div>
  );
}