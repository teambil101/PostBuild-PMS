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
  defaultBank?: string | null;
  defaultChequeNumber?: string | null;
  onSaved: () => void;
}

export function DepositChequeDialog({ open, onOpenChange, chequeId, contractId, sequence, defaultBank, defaultChequeNumber, onSaved }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [bank, setBank] = useState(defaultBank ?? "");
  const [chequeNumber, setChequeNumber] = useState(defaultChequeNumber ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!date) { toast.error("Deposit date is required."); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("lease_cheques" as never)
        .update({
          status: "deposited",
          deposited_on: date,
          bank_name: bank.trim() || null,
          cheque_number: chequeNumber.trim() || null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id" as never, chequeId as never);
      if (error) throw error;

      const { data: u } = await supabase.auth.getUser();
      await supabase.from("contract_events").insert({
        contract_id: contractId,
        event_type: "cheque_deposited",
        description: `Cheque #${sequence} deposited on ${date}${bank ? ` at ${bank}` : ""}.`,
        actor_id: u.user?.id,
      });

      toast.success(`Cheque #${sequence} marked as deposited.`);
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Could not deposit cheque.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deposit cheque #{sequence}</DialogTitle>
          <DialogDescription>Record when this cheque was handed to the bank for clearing.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="dep-date">Deposit date</Label>
            <Input id="dep-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="dep-bank">Bank name (optional)</Label>
            <Input id="dep-bank" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="e.g. Emirates NBD" />
          </div>
          <div>
            <Label htmlFor="dep-num">Cheque number (optional)</Label>
            <Input id="dep-num" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button variant="gold" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirm deposit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}