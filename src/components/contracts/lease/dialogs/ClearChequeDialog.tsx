import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chequeId: string;
  contractId: string;
  sequence: number;
  amount: number;
  currency: string;
  onSaved: () => void;
}

export function ClearChequeDialog({ open, onOpenChange, chequeId, contractId, sequence, amount, currency, onSaved }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!date) { toast.error("Clearing date is required."); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("lease_cheques" as never)
        .update({
          status: "cleared",
          cleared_on: date,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id" as never, chequeId as never);
      if (error) throw error;

      const { data: u } = await supabase.auth.getUser();
      await supabase.from("contract_events").insert({
        contract_id: contractId,
        event_type: "cheque_cleared",
        description: `Cheque #${sequence} (${currency} ${amount.toLocaleString()}) cleared on ${date}.`,
        actor_id: u.user?.id,
      });

      toast.success(`Cheque #${sequence} cleared.`);
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Could not clear cheque.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear cheque #{sequence}</DialogTitle>
          <DialogDescription>Confirm the bank credited the funds. This counts as paid revenue for the period.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Amount: <span className="text-architect mono">{currency} {amount.toLocaleString()}</span>
          </div>
          <div>
            <Label htmlFor="clr-date">Cleared on</Label>
            <Input id="clr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button variant="gold" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirm cleared
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}