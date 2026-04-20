import { Check, Circle, MinusCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { StageRow, StepRow } from "./types";

interface Props {
  stages: StageRow[];
  steps: StepRow[];
  selectedStageKey: string | null;
  onSelectStage: (stageKey: string) => void;
}

export function WorkflowTimeline({ stages, steps, selectedStageKey, onSelectStage }: Props) {
  return (
    <ol className="relative space-y-1">
      {stages.map((stage, i) => {
        const stageSteps = steps.filter((s) => s.stage_key === stage.stage_key);
        const completed = stageSteps.filter((s) => s.status === "complete").length;
        const total = stageSteps.length;
        const selected = stage.stage_key === selectedStageKey;
        const clickable = stage.status !== "pending";

        return (
          <li key={stage.id} className="relative">
            {i < stages.length - 1 && (
              <span
                className={cn(
                  "absolute left-[14px] top-8 bottom-[-4px] w-px",
                  stage.status === "complete" || stage.status === "skipped"
                    ? "bg-status-occupied"
                    : stage.status === "in_progress"
                      ? "border-l border-dashed border-warm-stone"
                      : "bg-warm-stone/60",
                )}
              />
            )}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onSelectStage(stage.stage_key)}
              className={cn(
                "w-full text-left flex items-start gap-3 rounded-sm px-2 py-2.5 transition-colors",
                selected ? "bg-muted/40" : "hover:bg-muted/20",
                !clickable && "cursor-default opacity-80",
              )}
              title={!clickable ? "Not yet reached" : undefined}
            >
              <span className="relative shrink-0 mt-0.5">
                <StageNode status={stage.status} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mono">
                  Stage {i + 1} of {stages.length}
                </span>
                <span
                  className={cn(
                    "block text-sm font-medium",
                    stage.status === "in_progress" ? "text-architect" : "text-foreground",
                    stage.status === "skipped" && "line-through text-muted-foreground",
                  )}
                >
                  {stage.stage_label}
                </span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">
                  {stage.status === "complete" &&
                    (stage.completed_at
                      ? `Completed ${format(new Date(stage.completed_at), "MMM d")}`
                      : "Completed")}
                  {stage.status === "skipped" && "Skipped"}
                  {stage.status === "in_progress" && (
                    <>
                      Current stage · {completed} of {total} steps done
                    </>
                  )}
                  {stage.status === "pending" && "Pending"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StageNode({ status }: { status: StageRow["status"] }) {
  if (status === "complete") {
    return (
      <span className="h-7 w-7 rounded-full bg-status-occupied text-white flex items-center justify-center">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="h-7 w-7 rounded-full border-2 border-warm-stone text-muted-foreground flex items-center justify-center bg-background">
        <MinusCircle className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="h-7 w-7 rounded-full border-2 border-gold bg-gold/10 flex items-center justify-center">
        <span className="h-2.5 w-2.5 rounded-full bg-gold" />
      </span>
    );
  }
  return (
    <span className="h-7 w-7 rounded-full border-2 border-warm-stone bg-background flex items-center justify-center">
      <Circle className="h-2.5 w-2.5 text-muted-foreground/40" />
    </span>
  );
}