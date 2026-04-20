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
  bouncedChequeId: string;
  leaseId: string;
  contractId: string;
  bouncedSequence: number;
  bouncedAmount: number;
  bouncedDueDate: string;
  nextSequence: number;
  currency: string;
  onSaved: () => void;
}

export function ReplaceChequeDialog({
  open, onOpenChange, bouncedChequeId, leaseId, contractId,
  bouncedSequence, bouncedAmount, bouncedDueDate, nextSequence, currency, onSaved,
}: Props) {
  const [amount, setAmount] = useState(String(bouncedAmount));
  const [dueDate, setDueDate] = useState(bouncedDueDate);
  const [chequeNumber, setChequeNumber] = useState("");
  const [bank, setBank] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Amount must be greater than zero."); return; }
    if (!dueDate) { toast.error("Due date is required."); return; }
    setSaving(true);
    try {
      // 1. Insert the replacement cheque
      const { data: inserted, error: insErr } = await supabase
        .from("lease_cheques" as never)
        .insert({
          lease_id: leaseId,
          sequence_number: nextSequence,
          amount: amt,
          due_date: dueDate,
          status: "pending",
          cheque_number: chequeNumber.trim() || null,
          bank_name: bank.trim() || null,
          notes: `Replacement for cheque #${bouncedSequence}.`,
        } as never)
        .select("id")
        .single();
      if (insErr) throw insErr;

      const newId = (inserted as any).id as string;

      // 2. Mark the bounced cheque as replaced and link it
      const { error: updErr } = await supabase
        .from("lease_cheques" as never)
        .update({
          status: "replaced",
          replacement_cheque_id: newId,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id" as never, bouncedChequeId as never);
      if (updErr) throw updErr;

      const { data: u } = await supabase.auth.getUser();
      await supabase.from("contract_events").insert({
        contract_id: contractId,
        event_type: "cheque_replaced",
        description: `Cheque #${bouncedSequence} replaced by #${nextSequence} (${currency} ${amt.toLocaleString()}, due ${dueDate}).`,
        actor_id: u.user?.id,
      });

      toast.success(`Replacement cheque #${nextSequence} added.`);
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Could not create replacement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace cheque #{bouncedSequence}</DialogTitle>
          <DialogDescription>
            A new pending cheque (#{nextSequence}) will be added and the bounced one will be marked as replaced.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rep-amt">Amount ({currency})</Label>
              <Input id="rep-amt" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="rep-due">Due date</Label>
              <Input id="rep-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="rep-num">Cheque number (optional)</Label>
            <Input id="rep-num" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="rep-bank">Bank name (optional)</Label>
            <Input id="rep-bank" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="e.g. Emirates NBD" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button variant="gold" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Add replacement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}