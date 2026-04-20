import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function GenericContractDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(""); setExternalRef(""); setStartDate(""); setEndDate(""); setNotes("");
    }
  }, [open]);

  const submit = async () => {
    if (!title.trim()) { toast.error("Title is required."); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const year = new Date().getFullYear();
    const { data: settings } = await supabase.from("app_settings").select("contract_number_prefix, default_currency").maybeSingle();
    const prefix = settings?.contract_number_prefix ?? "CTR";
    const currency = settings?.default_currency ?? "AED";
    const { data: numberResult, error: numErr } = await supabase.rpc("next_number", { p_prefix: prefix, p_year: year });
    if (numErr || !numberResult) { setBusy(false); toast.error("Could not generate contract number."); return; }
    const { data: c, error } = await supabase
      .from("contracts")
      .insert({
        contract_type: "other",
        contract_number: numberResult as string,
        external_reference: externalRef.trim() || null,
        title: title.trim(),
        status: "draft",
        start_date: startDate || null,
        end_date: endDate || null,
        currency,
        notes: notes.trim() || null,
        created_by: u.user?.id,
      })
      .select("id")
      .maybeSingle();
    setBusy(false);
    if (error || !c) { toast.error(error?.message ?? "Could not create contract."); return; }
    await supabase.from("contract_events").insert({
      contract_id: c.id, event_type: "created", to_value: "draft", description: "Generic contract created",
      actor_id: u.user?.id,
    });
    toast.success(`Contract ${numberResult} created.`);
    onOpenChange(false);
    navigate(`/contracts/${c.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New contract</DialogTitle>
          <DialogDescription>Generic contract — minimal fields. Add parties, subjects, and documents from the detail page.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">External reference</Label>
            <Input value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">End date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="gold" onClick={submit} disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create contract"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}