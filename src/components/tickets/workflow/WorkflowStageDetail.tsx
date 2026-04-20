import { useState } from "react";
import { format } from "date-fns";
import { ArrowRight, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { advanceTicketStage, skipTicketStage } from "@/lib/workflows";
import { StepRowItem } from "./StepRowItem";
import type { StageRow, StepRow, PersonNameLookup } from "./types";

interface Props {
  ticketId: string;
  stage: StageRow;
  steps: StepRow[];
  nextStage: StageRow | null;
  isCurrent: boolean;
  onChanged: () => void;
  onBackToCurrent: () => void;
  personName: PersonNameLookup;
  stageDescription?: string;
}

export function WorkflowStageDetail({
  ticketId,
  stage,
  steps,
  nextStage,
  isCurrent,
  onChanged,
  onBackToCurrent,
  personName,
  stageDescription,
}: Props) {
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [busy, setBusy] = useState(false);

  const requiredPending = steps.filter((s) => s.is_required && s.status === "pending").length;
  const completedSteps = steps.filter((s) => s.status === "complete").length;
  const canAdvance = isCurrent && requiredPending === 0;

  const handleAdvance = async () => {
    setBusy(true);
    try {
      await advanceTicketStage(ticketId);
      setAdvanceOpen(false);
      toast.success(nextStage ? `Advanced to ${nextStage.stage_label}` : "Workflow complete");
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Could not advance.");
    } finally {
      setBusy(false);
    }
  };

  const handleSkipStage = async () => {
    if (!skipReason.trim() || skipReason.trim().length < 2) {
      toast.error("Reason is required to skip a stage.");
      return;
    }
    setBusy(true);
    try {
      await skipTicketStage(ticketId, stage.stage_key, skipReason.trim());
      setSkipOpen(false);
      setSkipReason("");
      toast.success(`Skipped ${stage.stage_label}`);
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Could not skip stage.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border hairline rounded-sm bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="label-eyebrow text-true-taupe mb-1">
            {isCurrent ? "Current stage" : stage.status === "complete" ? "Completed stage" : "Skipped stage"}
            {stage.completed_at && !isCurrent && ` · ${format(new Date(stage.completed_at), "MMM d, yyyy")}`}
          </div>
          <h2 className="font-display text-2xl text-architect leading-tight">{stage.stage_label}</h2>
          {stageDescription && (
            <p className="text-sm text-muted-foreground mt-1">{stageDescription}</p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1.5 mono">
            {completedSteps} of {steps.length} steps complete
          </p>
        </div>
        {isCurrent && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setSkipOpen(true)}>Skip this stage</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Skipped reason */}
      {stage.status === "skipped" && stage.skipped_reason && (
        <div className="border-l-2 border-warm-stone bg-muted/30 px-3 py-2 text-sm italic text-muted-foreground rounded-sm">
          Skipped: {stage.skipped_reason}
        </div>
      )}

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step) => (
          <StepRowItem
            key={step.id}
            step={step}
            ticketId={ticketId}
            readOnly={!isCurrent}
            personName={personName}
            onChanged={onChanged}
          />
        ))}
      </div>

      {/* Footer actions */}
      {isCurrent ? (
        <div className="pt-2 space-y-2">
          <Button
            variant="gold"
            size="lg"
            className="w-full"
            disabled={!canAdvance}
            onClick={() => setAdvanceOpen(true)}
          >
            {nextStage ? `Advance to ${nextStage.stage_label}` : "Complete workflow"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          {!canAdvance && (
            <p className="text-[11px] text-center text-muted-foreground">
              {requiredPending} required step{requiredPending === 1 ? "" : "s"} pending — complete them first
            </p>
          )}
        </div>
      ) : (
        <div className="pt-2">
          <Button variant="ghost" size="sm" onClick={onBackToCurrent}>
            ← Back to current stage
          </Button>
        </div>
      )}

      {/* Advance dialog */}
      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{nextStage ? `Advance to ${nextStage.stage_label}?` : "Complete workflow?"}</DialogTitle>
            <DialogDescription>
              {nextStage
                ? `This marks ${stage.stage_label} as complete and starts ${nextStage.stage_label}.`
                : `This marks ${stage.stage_label} as complete and finishes the workflow. The ticket's own status is unchanged — you can resolve or close it separately.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvanceOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleAdvance} disabled={busy}>
              {nextStage ? "Advance" : "Complete workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Skip stage dialog */}
      <Dialog open={skipOpen} onOpenChange={setSkipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip {stage.stage_label}?</DialogTitle>
            <DialogDescription>
              Skipped stages preserve any completed steps but don't block workflow advancement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Textarea
              placeholder="Reason (required, min 2 chars)"
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkipOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSkipStage} disabled={busy || skipReason.trim().length < 2}>
              Skip stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}