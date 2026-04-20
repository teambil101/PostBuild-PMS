import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { BOUNCE_REASONS, BOUNCE_REASON_LABELS, type BounceReason } from "@/lib/leases";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chequeId: string;
  contractId: string;
  sequence: number;
  onSaved: () => void;
}

export function BounceChequeDialog({ open, onOpenChange, chequeId, contractId, sequence, onSaved }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState<BounceReason>("nsf");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!date) { toast.error("Bounce date is required."); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("lease_cheques" as never)
        .update({
          status: "bounced",
          bounced_on: date,
          bounce_reason: reason,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id" as never, chequeId as never);
      if (error) throw error;

      const { data: u } = await supabase.auth.getUser();
      await supabase.from("contract_events").insert({
        contract_id: contractId,
        event_type: "cheque_bounced",
        description: `Cheque #${sequence} bounced on ${date} — ${BOUNCE_REASON_LABELS[reason]}.`,
        actor_id: u.user?.id,
      });

      toast.success(`Cheque #${sequence} marked as bounced.`);
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Could not record bounce.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark cheque #{sequence} as bounced</DialogTitle>
          <DialogDescription>
            Record the rejection. After saving, use "Replace" to issue a substitute cheque.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="bnc-date">Bounce date</Label>
            <Input id="bnc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="bnc-reason">Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as BounceReason)}>
              <SelectTrigger id="bnc-reason"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BOUNCE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{BOUNCE_REASON_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="bnc-notes">Notes (optional)</Label>
            <Textarea id="bnc-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bank reference, customer call notes…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Mark bounced
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}