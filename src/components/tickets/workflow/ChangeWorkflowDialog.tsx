import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { changeTicketWorkflow, WORKFLOWS, type WorkflowKey } from "@/lib/workflows";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
  currentWorkflowKey: WorkflowKey;
  /** Map of step_key → current status, so we can show what will be preserved with state. */
  currentStepStatusMap: Record<string, "pending" | "complete" | "skipped">;
  onDone: () => void;
  onSwitchToRemove: () => void;
}

export function ChangeWorkflowDialog({
  open,
  onOpenChange,
  ticketId,
  currentWorkflowKey,
  currentStepStatusMap,
  onDone,
  onSwitchToRemove,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [picked, setPicked] = useState<WorkflowKey | "__none" | "">("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep(1);
    setPicked("");
    setConfirm("");
  };

  const oldKeys = useMemo(() => {
    const def = WORKFLOWS[currentWorkflowKey];
    return new Set(def.stages.flatMap((s) => s.steps.map((st) => st.key)));
  }, [currentWorkflowKey]);

  const newKeys = useMemo(() => {
    if (!picked || picked === "__none") return new Set<string>();
    return new Set(WORKFLOWS[picked as WorkflowKey].stages.flatMap((s) => s.steps.map((st) => st.key)));
  }, [picked]);

  const preserved = useMemo(() => Array.from(oldKeys).filter((k) => newKeys.has(k)), [oldKeys, newKeys]);
  const archived = useMemo(() => Array.from(oldKeys).filter((k) => !newKeys.has(k)), [oldKeys, newKeys]);
  const added = useMemo(() => Array.from(newKeys).filter((k) => !oldKeys.has(k)), [oldKeys, newKeys]);

  const archivedCompletedCount = archived.filter(
    (k) => currentStepStatusMap[k] === "complete",
  ).length;

  const requiresTypedConfirm = archivedCompletedCount > 0;

  const handleNext = () => {
    if (!picked) return;
    if (picked === "__none") {
      onOpenChange(false);
      onSwitchToRemove();
      reset();
      return;
    }
    setStep(2);
  };

  const handleConfirm = async () => {
    if (!picked || picked === "__none") return;
    if (requiresTypedConfirm && confirm !== "CONFIRM") return;
    setBusy(true);
    try {
      await changeTicketWorkflow(ticketId, currentWorkflowKey, picked);
      toast.success(`Workflow changed to ${WORKFLOWS[picked].label}.`);
      onOpenChange(false);
      reset();
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Could not change workflow.");
    } finally {
      setBusy(false);
    }
  };

  const otherWorkflows = Object.values(WORKFLOWS).filter((w) => w.key !== currentWorkflowKey);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step === 1 ? "Change workflow" : "Review impact"}</DialogTitle>
          <DialogDescription>
            {step === 1
              ? `Currently: ${WORKFLOWS[currentWorkflowKey].label}. Pick a different workflow.`
              : "Review which steps will be preserved, archived, or added."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-1.5">
            <Label>New workflow</Label>
            <Select value={picked as string} onValueChange={(v) => setPicked(v as WorkflowKey | "__none")}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a workflow…" />
              </SelectTrigger>
              <SelectContent>
                {otherWorkflows.map((w) => (
                  <SelectItem key={w.key} value={w.key}>
                    {w.label}
                  </SelectItem>
                ))}
                <SelectItem value="__none">None (remove workflow)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-4">
            <DiffBlock
              title="Preserved"
              tone="ok"
              items={preserved.map((k) => ({
                key: k,
                meta: currentStepStatusMap[k] ?? "pending",
              }))}
              emptyText="No matching step keys to preserve."
              metaSuffix="will be preserved"
            />
            <DiffBlock
              title="Archived (old only)"
              tone="warn"
              items={archived.map((k) => ({ key: k, meta: currentStepStatusMap[k] ?? "pending" }))}
              emptyText="No old-only steps."
              metaSuffix="will be archived"
            />
            {archivedCompletedCount > 0 && (
              <div className="text-xs text-amber-700 border border-amber-500/30 bg-amber-500/5 rounded-sm p-2">
                This will archive {archivedCompletedCount} completed step
                {archivedCompletedCount === 1 ? "" : "s"}.
              </div>
            )}
            <DiffBlock
              title="Added (new only)"
              tone="info"
              items={added.map((k) => ({ key: k, meta: "pending" }))}
              emptyText="No new-only steps."
              metaSuffix="will start pending"
            />

            {requiresTypedConfirm && (
              <div className="space-y-1.5 pt-2">
                <Label>
                  Type <span className="mono">CONFIRM</span> to proceed
                </Label>
                <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="CONFIRM" />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="gold" onClick={handleNext} disabled={!picked}>
                Next
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep(1)} disabled={busy}>
                Back
              </Button>
              <Button
                variant="gold"
                onClick={handleConfirm}
                disabled={busy || (requiresTypedConfirm && confirm !== "CONFIRM")}
              >
                Change workflow
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiffBlock({
  title,
  tone,
  items,
  emptyText,
  metaSuffix,
}: {
  title: string;
  tone: "ok" | "warn" | "info";
  items: { key: string; meta: string }[];
  emptyText: string;
  metaSuffix: string;
}) {
  const toneCls =
    tone === "ok"
      ? "border-status-occupied/30 bg-status-occupied/5"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-warm-stone bg-muted/20";
  return (
    <div className={cn("rounded-sm border p-3", toneCls)}>
      <div className="label-eyebrow mb-2">{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">{emptyText}</div>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.key} className="text-xs flex items-center justify-between gap-3">
              <span className="mono text-architect truncate">{it.key}</span>
              <span className="text-muted-foreground shrink-0">
                {it.meta} · {metaSuffix}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}