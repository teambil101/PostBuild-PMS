import { useState } from "react";
import { format } from "date-fns";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  completeTicketStep,
  uncompleteTicketStep,
  skipTicketStep,
} from "@/lib/workflows";
import type { StepRow, PersonNameLookup } from "./types";

interface Props {
  step: StepRow;
  ticketId: string;
  readOnly: boolean;
  personName: PersonNameLookup;
  onChanged: () => void;
}

export function StepRowItem({ step, ticketId, readOnly, personName, onChanged }: Props) {
  const [completeOpen, setCompleteOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [uncheckOpen, setUncheckOpen] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const handleComplete = async () => {
    setBusy(true);
    try {
      await completeTicketStep(ticketId, step.stage_key, step.step_key, note.trim() || undefined);
      setCompleteOpen(false);
      setNote("");
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Could not complete step.");
    } finally {
      setBusy(false);
    }
  };

  const handleUncheck = async () => {
    setBusy(true);
    try {
      await uncompleteTicketStep(ticketId, step.stage_key, step.step_key);
      setUncheckOpen(false);
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Could not uncheck step.");
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async () => {
    if (!reason.trim()) {
      toast.error("Provide a reason to skip.");
      return;
    }
    setBusy(true);
    try {
      await skipTicketStep(ticketId, step.stage_key, step.step_key, reason.trim());
      setSkipOpen(false);
      setReason("");
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Could not skip step.");
    } finally {
      setBusy(false);
    }
  };

  const isComplete = step.status === "complete";
  const isSkipped = step.status === "skipped";

  return (
    <div
      className={cn(
        "border hairline rounded-sm bg-card p-3.5 transition-colors",
        isComplete && "bg-status-occupied/5 border-status-occupied/20",
        isSkipped && "bg-muted/30 opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox / state */}
        <div className="mt-0.5 shrink-0">
          {isComplete ? (
            !readOnly ? (
              <Popover open={uncheckOpen} onOpenChange={setUncheckOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="h-4 w-4 rounded-sm bg-status-occupied text-white flex items-center justify-center hover:opacity-80"
                    aria-label="Uncheck step"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="start">
                  <div className="space-y-3">
                    <div className="text-sm">Uncheck this step?</div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setUncheckOpen(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" variant="destructive" onClick={handleUncheck} disabled={busy}>
                        Uncheck
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <span className="h-4 w-4 rounded-sm bg-status-occupied text-white flex items-center justify-center">
                <Check className="h-3 w-3" />
              </span>
            )
          ) : isSkipped ? (
            <span className="h-4 w-4 rounded-sm border border-warm-stone bg-background flex items-center justify-center text-muted-foreground">
              <X className="h-3 w-3" />
            </span>
          ) : !readOnly ? (
            <Popover open={completeOpen} onOpenChange={setCompleteOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-4 w-4 rounded-sm border border-primary bg-background hover:bg-muted/40"
                  aria-label="Complete step"
                />
              </PopoverTrigger>
              <PopoverContent className="w-72" align="start">
                <div className="space-y-3">
                  <div className="text-sm font-medium">Mark step complete</div>
                  <Textarea
                    placeholder="Optional note…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="min-h-[60px] text-sm"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setCompleteOpen(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" variant="gold" onClick={handleComplete} disabled={busy}>
                      Mark complete
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <Checkbox checked={false} disabled />
          )}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div
              className={cn(
                "text-sm flex-1",
                isComplete && "text-architect",
                isSkipped && "line-through text-muted-foreground",
              )}
            >
              {step.step_label}
            </div>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider mono shrink-0 px-1.5 rounded-sm border hairline",
                step.is_required ? "text-amber-700 border-amber-500/30 bg-amber-500/5" : "text-muted-foreground",
              )}
            >
              {step.is_required ? "Required" : "Optional"}
            </span>
          </div>
          {step.step_description && (
            <div className="text-[11px] text-muted-foreground mt-1">{step.step_description}</div>
          )}
          {isComplete && (
            <div className="text-[11px] text-muted-foreground mt-1.5">
              ✓ Completed
              {step.completed_by ? ` by ${personName(step.completed_by) ?? "Unknown"}` : ""}
              {step.completed_at && ` · ${format(new Date(step.completed_at), "MMM d, yyyy")}`}
              {step.note && (
                <div className="italic mt-0.5">Note: {step.note}</div>
              )}
            </div>
          )}
          {isSkipped && (
            <div className="text-[11px] text-muted-foreground mt-1.5 italic">
              Skipped: {step.note || "no reason given"}
            </div>
          )}

          {/* Skip action for optional pending */}
          {!readOnly && step.status === "pending" && !step.is_required && (
            <div className="mt-2">
              <Popover open={skipOpen} onOpenChange={setSkipOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground">
                    Skip
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="start">
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Skip this step</div>
                    <Textarea
                      placeholder="Reason (required)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="min-h-[60px] text-sm"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setSkipOpen(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleSkip} disabled={busy || !reason.trim()}>
                        Skip
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}