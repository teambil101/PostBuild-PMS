import { useState } from "react";
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
import { removeTicketWorkflow, WORKFLOWS, type WorkflowKey } from "@/lib/workflows";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
  workflowKey: WorkflowKey;
  onDone: () => void;
}

export function RemoveWorkflowDialog({ open, onOpenChange, ticketId, workflowKey, onDone }: Props) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const handleRemove = async () => {
    if (confirm !== workflowKey) return;
    setBusy(true);
    try {
      await removeTicketWorkflow(ticketId);
      toast.success("Workflow removed.");
      onOpenChange(false);
      setConfirm("");
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Could not remove workflow.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setConfirm(""); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove workflow from this ticket?</DialogTitle>
          <DialogDescription>
            The ticket will become freeform. All workflow progress, including completed and
            skipped steps, will be deleted. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>
            Type <span className="mono text-architect">{workflowKey}</span> to confirm
          </Label>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={workflowKey}
          />
          <p className="text-[11px] text-muted-foreground">
            Currently using: {WORKFLOWS[workflowKey].label}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={busy || confirm !== workflowKey}
          >
            Remove workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}