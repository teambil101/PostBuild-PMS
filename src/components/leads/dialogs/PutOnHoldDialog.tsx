import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LeadRow } from "@/lib/leads";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: LeadRow;
  onSaved: () => void;
}

export function PutOnHoldDialog({ open, onOpenChange, lead, onSaved }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason.trim()) {
      toast.error("A reason is required.");
      return;
    }
    setBusy(true);
    // pre_hold_status captures the stage we're pausing from, for "resume to" default.
    const { error } = await supabase.from("leads").update({
      status: "on_hold",
      hold_reason: reason.trim(),
      pre_hold_status: lead.status === "on_hold" ? lead.pre_hold_status : lead.status,
    }).eq("id", lead.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Lead put on hold.");
    onOpenChange(false);
    setReason("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Put lead on hold</DialogTitle>
          <DialogDescription>
            Pause this lead without losing it. Use when timing isn&rsquo;t right or you&rsquo;re waiting on external factors.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Reason *</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are we pausing?"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="gold" onClick={submit} disabled={busy || !reason.trim()}>
            {busy ? "Saving…" : "Put on hold"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}