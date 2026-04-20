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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initializeTicketWorkflow, WORKFLOWS, type WorkflowKey } from "@/lib/workflows";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
  onDone: () => void;
}

export function AddWorkflowDialog({ open, onOpenChange, ticketId, onDone }: Props) {
  const [picked, setPicked] = useState<WorkflowKey | "">("");
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await initializeTicketWorkflow(ticketId, picked);
      toast.success(`Workflow ${WORKFLOWS[picked].label} added.`);
      onOpenChange(false);
      setPicked("");
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Could not add workflow.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add workflow</DialogTitle>
          <DialogDescription>
            Pick a workflow to structure this ticket's work.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Workflow</Label>
          <Select value={picked} onValueChange={(v) => setPicked(v as WorkflowKey)}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a workflow…" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(WORKFLOWS).map((w) => (
                <SelectItem key={w.key} value={w.key}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {picked && (
            <p className="text-[11px] text-muted-foreground mt-1">
              {WORKFLOWS[picked].description}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="gold" onClick={handleAdd} disabled={busy || !picked}>
            Add workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}