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

/** Generic stage transition dialog. Excludes contract_signed (L2) and lost (own dialog). */
export function ChangeStageDialog({ open, onOpenChange, lead, onSaved }: Props) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (status === lead.status) {
      toast.info("Stage unchanged.");
      return;
    }
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
        body: `Stage changed to ${LEAD_STATUS_LABELS[status]} — ${note.trim()}`,
        author_id: u.user?.id,
      });
    }
    setBusy(false);
    toast.success(`Stage updated to ${LEAD_STATUS_LABELS[status]}.`);
    onOpenChange(false);
    setNote("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Change lead stage</DialogTitle>
          <DialogDescription>
            Currently <span className="font-medium text-architect">{LEAD_STATUS_LABELS[lead.status]}</span>.
            Use the dedicated actions for &ldquo;Mark Lost&rdquo; or &ldquo;Put on Hold&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">New stage *</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAD_CHANGEABLE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{LEAD_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note (optional)</Label>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this transition? (Will be added as a note.)"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="gold" onClick={submit} disabled={busy}>
            {busy ? "Updating…" : "Update stage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}