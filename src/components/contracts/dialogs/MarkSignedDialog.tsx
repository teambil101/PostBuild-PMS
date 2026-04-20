import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatEnumLabel } from "@/lib/format";

interface PartyLite {
  id: string;
  person_id: string;
  role: string;
  is_signatory: boolean;
  signed_at: string | null;
  display_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string;
  parties: PartyLite[];
  onSaved?: (allSigned: boolean) => void;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

export function MarkSignedDialog({ open, onOpenChange, contractId, parties, onSaved }: Props) {
  const signatories = parties.filter((p) => p.is_signatory);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const seed: Record<string, string> = {};
    signatories.forEach((p) => {
      seed[p.id] = p.signed_at ?? todayISO();
    });
    setDates(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    let updated = 0;
    for (const p of signatories) {
      const newDate = dates[p.id];
      if (!newDate) continue;
      const { error } = await supabase
        .from("contract_parties")
        .update({ signed_at: newDate })
        .eq("id", p.id);
      if (error) {
        setSubmitting(false);
        toast.error(error.message);
        return;
      }
      updated++;
    }
    await supabase.from("contract_events").insert({
      contract_id: contractId,
      event_type: "signed",
      description: `${updated} signature${updated === 1 ? "" : "s"} recorded`,
      actor_id: u.user?.id,
    });

    const allSigned = signatories.every((p) => !!dates[p.id]);
    setSubmitting(false);
    toast.success("Signatures saved.");
    onOpenChange(false);
    onSaved?.(allSigned);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record signatures</DialogTitle>
          <DialogDescription>When did each party sign?</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {signatories.length === 0 ? (
            <div className="text-sm text-muted-foreground">No signatories on this contract.</div>
          ) : (
            signatories.map((p) => (
              <div key={p.id} className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-2 sm:items-center border hairline rounded-sm p-3 bg-card">
                <div className="min-w-0">
                  <div className="text-sm text-architect truncate">{p.display_name}</div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    {formatEnumLabel(p.role)}
                  </div>
                </div>
                <div>
                  <Label className="sr-only">Signed on</Label>
                  <Input
                    type="date"
                    value={dates[p.id] ?? ""}
                    onChange={(e) => setDates((s) => ({ ...s, [p.id]: e.target.value }))}
                  />
                </div>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button variant="gold" onClick={handleSave} disabled={submitting || signatories.length === 0}>
            {submitting ? "Saving…" : "Save signatures"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}