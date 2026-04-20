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
  LEAD_CHANGEABLE_STATUSES, LEAD_STATUS_LABELS, type LeadStatus, type LeadRow,
} from "@/lib/leads";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: LeadRow;
  onSaved: () => void;
}

export function ResumeFromHoldDialog({ open, onOpenChange, lead, onSaved }: Props) {
  // Default to pre_hold_status if it's a valid resumable stage, else "qualified".
  const defaultStage =
    lead.pre_hold_status && LEAD_CHANGEABLE_STATUSES.includes(lead.pre_hold_status as LeadStatus) && lead.pre_hold_status !== "on_hold"
      ? (lead.pre_hold_status as LeadStatus)
      : "qualified";

  const [status, setStatus] = useState<LeadStatus>(defaultStage);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.from("leads").update({ status }).eq("id", lead.id);
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    if (note.trim()) {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("notes").insert({
        entity_type: "lead",
        entity_id: lead.id,
        body: `Resumed from hold — ${note.trim()}`,
        author_id: u.user?.id,
      });
    }
    setBusy(false);
    toast.success(`Lead resumed at ${LEAD_STATUS_LABELS[status]}.`);
    onOpenChange(false);
    setNote("");
    onSaved();
  };

  // Resume options exclude on_hold and terminal stages.
  const resumeOptions = LEAD_CHANGEABLE_STATUSES.filter((s) => s !== "on_hold");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Resume this lead?</DialogTitle>
          <DialogDescription>
            Default is the stage it was in before being paused.
            {lead.hold_reason && (
              <> Hold reason: <span className="italic">{lead.hold_reason}</span></>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Resume to stage *</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {resumeOptions.map((s) => (
                  <SelectItem key={s} value={s}>{LEAD_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="gold" onClick={submit} disabled={busy}>
            {busy ? "Resuming…" : "Resume"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}