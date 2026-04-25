import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invoiceBalance, round2, toNum } from "@/lib/financialFormulas";
import { docPrefix, nextDocNumber } from "@/lib/financials";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";

type InvoiceForAlloc = {
  id: string;
  number: string;
  due_date: string;
  total: number;
  amount_paid: number;
  currency: string;
};

type BankAccount = {
  id: string;
  name: string;
  currency: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-load these invoices for allocation (e.g. all open invoices for a tenant). */
  invoices: InvoiceForAlloc[];
  /** Default party for the payment record (tenant making rent payment). */
  partyPersonId: string | null;
  /** Default currency. */
  currency: string;
  /** Called after a successful save. */
  onSaved: () => void;
}

const METHODS = [
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "online", label: "Online" },
  { value: "other", label: "Other" },
] as const;

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoices,
  partyPersonId,
  currency,
  onSaved,
}: Props) {
  const { activeWorkspace } = useWorkspace();
  const [paidOn, setPaidOn] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<string>("cheque");
  const [reference, setReference] = useState<string>("");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAllocations({});
    setReference("");
    setNotes("");
    setPaidOn(new Date().toISOString().slice(0, 10));
    void loadBanks();
  }, [open]);

  const loadBanks = async () => {
    const { data } = await supabase
      .from("bank_accounts")
      .select("id, name, currency")
      .eq("is_active", true)
      .order("name");
    setBanks((data as BankAccount[]) ?? []);
  };

  const totalAllocated = useMemo(
    () => round2(Object.values(allocations).reduce((s, v) => s + toNum(v), 0)),
    [allocations],
  );

  const fillFull = (inv: InvoiceForAlloc) => {
    const bal = invoiceBalance(inv);
    setAllocations((prev) => ({ ...prev, [inv.id]: bal.toFixed(2) }));
  };

  const fillAll = () => {
    const next: Record<string, string> = {};
    for (const inv of invoices) {
      const bal = invoiceBalance(inv);
      if (bal > 0) next[inv.id] = bal.toFixed(2);
    }
    setAllocations(next);
  };

  const handleSave = async () => {
    if (totalAllocated <= 0) {
      toast.error("Allocate at least one amount.");
      return;
    }

    // Validate per-invoice allocation cap
    for (const inv of invoices) {
      const v = toNum(allocations[inv.id]);
      if (v < 0) {
        toast.error(`Allocation for ${inv.number} cannot be negative.`);
        return;
      }
      if (v > invoiceBalance(inv) + 0.01) {
        toast.error(`Allocation for ${inv.number} exceeds the open balance.`);
        return;
      }
    }

    setSaving(true);
    try {
      if (!activeWorkspace?.id) {
        toast.error("No active workspace selected.");
        setSaving(false);
        return;
      }
      const number = await nextDocNumber(docPrefix("payment"), activeWorkspace.id);
      const { data: pay, error: payErr } = await supabase
        .from("payments")
        .insert({
          number,
          direction: "in",
          method: method as any,
          amount: totalAllocated,
          currency,
          paid_on: paidOn,
          bank_account_id: bankAccountId || null,
          reference: reference || null,
          party_person_id: partyPersonId,
          notes: notes || null,
        })
        .select("id")
        .single();
      if (payErr || !pay) throw payErr ?? new Error("Failed to create payment");

      // Create allocations + update each invoice's amount_paid + status
      for (const inv of invoices) {
        const v = round2(toNum(allocations[inv.id]));
        if (v <= 0) continue;
        await supabase.from("payment_allocations").insert({
          payment_id: pay.id,
          invoice_id: inv.id,
          amount: v,
        });
        const newPaid = round2(toNum(inv.amount_paid) + v);
        const newStatus =
          newPaid >= toNum(inv.total) - 0.005 ? "paid" : "partial";
        await supabase
          .from("invoices")
          .update({ amount_paid: newPaid, status: newStatus as any })
          .eq("id", inv.id);
      }

      toast.success(`Payment ${number} recorded`);
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const openInvoices = invoices.filter((i) => invoiceBalance(i) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Date received</Label>
            <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reference</Label>
            <Input
              placeholder="Cheque #, txn ID, …"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Deposited to</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger><SelectValue placeholder="Select bank account (optional)" /></SelectTrigger>
              <SelectContent>
                {banks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2 mt-2">
          <div className="flex items-center justify-between">
            <Label>Allocate to invoices</Label>
            {openInvoices.length > 1 && (
              <button
                type="button"
                onClick={fillAll}
                className="text-xs text-architect hover:underline"
              >
                Fill all balances
              </button>
            )}
          </div>

          {openInvoices.length === 0 ? (
            <div className="text-xs text-muted-foreground border hairline rounded-sm p-4 text-center">
              No open invoices to allocate against.
            </div>
          ) : (
            <div className="border hairline rounded-sm divide-y">
              {openInvoices.map((inv) => {
                const bal = invoiceBalance(inv);
                const alloc = toNum(allocations[inv.id]);
                return (
                  <div key={inv.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="mono text-xs text-architect">{inv.number}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Due {new Date(inv.due_date).toLocaleDateString()} · Balance {currency}{" "}
                        {bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={bal}
                      placeholder="0.00"
                      value={allocations[inv.id] ?? ""}
                      onChange={(e) =>
                        setAllocations((prev) => ({ ...prev, [inv.id]: e.target.value }))
                      }
                      className={cn("w-32 h-8 text-right tabular-nums", alloc > bal + 0.01 && "border-red-500")}
                    />
                    <button
                      type="button"
                      onClick={() => fillFull(inv)}
                      className="text-[11px] text-muted-foreground hover:text-architect"
                    >
                      Full
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 text-sm">
            <span className="text-muted-foreground">Total allocated</span>
            <span className="font-medium tabular-nums text-architect">
              {currency} {totalAllocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || totalAllocated <= 0}>
            {saving ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
