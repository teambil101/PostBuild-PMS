import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  LEAD_LOST_REASONS, LEAD_LOST_REASON_LABELS, type LeadLostReason, type LeadRow,
} from "@/lib/leads";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: LeadRow;
  onSaved: () => void;
}

export function MarkLostDialog({ open, onOpenChange, lead, onSaved }: Props) {
  const [reason, setReason] = useState<LeadLostReason | "">("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const requireNotes = reason === "other";
  const valid = !!reason && (!requireNotes || notes.trim().length > 0);

  const submit = async () => {
    if (!valid) {
      toast.error(requireNotes ? "Please add details for 'Other'." : "Choose a reason.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("leads").update({
      status: "lost",
      lost_reason: reason,
      lost_reason_notes: notes.trim() || null,
    }).eq("id", lead.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Lead marked as lost.");
    onOpenChange(false);
    setReason("");
    setNotes("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Mark as lost</DialogTitle>
          <DialogDescription>
            Record why this lead didn&rsquo;t convert. Useful for learning and follow-up opportunities.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Lost reason *</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as LeadLostReason)}>
              <SelectTrigger><SelectValue placeholder="Pick a reason…" /></SelectTrigger>
              <SelectContent>
                {LEAD_LOST_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{LEAD_LOST_REASON_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Details {requireNotes && "*"}</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={requireNotes ? "Required for 'Other'." : "Optional context."}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={busy || !valid}>
            {busy ? "Saving…" : "Mark lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}