import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LEAD_STATUS_LABELS, type LeadRow, type LeadStatus } from "@/lib/leads";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: LeadRow;
  /** Where to move the lead on confirm. */
  targetStatus: LeadStatus;
  onReopened: () => void;
  onCancel?: () => void;
}

/**
 * Confirms reopening a Lost lead into a non-terminal stage.
 * Clears lost_at / lost_reason / lost_reason_notes; trigger logs status_changed.
 */
export function ReopenLostDialog({
  open, onOpenChange, lead, targetStatus, onReopened, onCancel,
}: Props) {
  const [busy, setBusy] = useState(false);

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) onCancel?.();
  };

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("leads")
      .update({
        status: targetStatus,
        lost_at: null,
        lost_reason: null,
        lost_reason_notes: null,
      })
      .eq("id", lead.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Reopened to ${LEAD_STATUS_LABELS[targetStatus]}.`);
    onOpenChange(false);
    onReopened();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Reopen this lead?</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-architect">{lead.lead_number}</span> is currently marked as <span className="font-medium text-architect">Lost</span>.
            Reopening will move it to <span className="font-medium text-architect">{LEAD_STATUS_LABELS[targetStatus]}</span> and clear the lost reason.
            The previous reason stays in the lead's history for reference.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={busy}>Cancel</Button>
          <Button variant="gold" onClick={submit} disabled={busy}>
            {busy ? "Reopening…" : "Reopen lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
