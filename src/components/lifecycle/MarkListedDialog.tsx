import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unitId: string;
  unitNumber: string;
  buildingName: string;
  initialAskingRent?: number | null;
  initialCurrency?: string | null;
  initialNotes?: string | null;
  onSaved: () => void;
}

export function MarkListedDialog({
  open, onOpenChange, unitId, unitNumber, buildingName,
  initialAskingRent, initialCurrency, initialNotes, onSaved,
}: Props) {
  const [askingRent, setAskingRent] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAskingRent(initialAskingRent != null ? String(initialAskingRent) : "");
    setCurrency(initialCurrency || "AED");
    setNotes(initialNotes ?? "");
  }, [open, initialAskingRent, initialCurrency, initialNotes]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const rentNum = askingRent.trim() ? Number(askingRent) : null;
    if (rentNum != null && (!Number.isFinite(rentNum) || rentNum <= 0)) {
      toast.error("Asking rent must be a positive number.");
      setBusy(false);
      return;
    }
    const { error } = await supabase
      .from("units")
      .update({
        listed_at: new Date().toISOString(),
        asking_rent: rentNum,
        asking_rent_currency: rentNum != null ? currency : null,
        listing_notes: notes.trim() || null,
      })
      .eq("id", unitId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${unitNumber} marked as listed.`);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Mark as listed</DialogTitle>
          <DialogDescription>
            {unitNumber} · {buildingName}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div>
            <Label className="text-xs font-medium text-architect normal-case tracking-normal">
              Asking rent (annual)
            </Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={askingRent}
                onChange={(e) => setAskingRent(e.target.value)}
                placeholder="e.g. 120000"
                className="flex-1"
              />
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
                className="w-20 mono uppercase text-center"
                maxLength={3}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Optional — surfaces on the listing card.</p>
          </div>
          <div>
            <Label className="text-xs font-medium text-architect normal-case tracking-normal">
              Listing notes
            </Label>
            <Textarea
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Channel, agent, any quirks…"
              className="mt-1.5"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Saving…" : "Mark as listed"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
