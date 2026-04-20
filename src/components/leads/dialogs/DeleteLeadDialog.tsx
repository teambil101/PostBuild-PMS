import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LeadRow } from "@/lib/leads";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: LeadRow;
}

export function DeleteLeadDialog({ open, onOpenChange, lead }: Props) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const matches = confirm.trim() === lead.lead_number;

  const submit = async () => {
    if (!matches) return;
    setBusy(true);
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Lead deleted.");
    onOpenChange(false);
    navigate("/leads");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setConfirm(""); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Delete this lead?</DialogTitle>
          <DialogDescription>
            All events, notes, and documents tied to this lead will be removed. People records are preserved.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          <Label className="text-xs">
            Type <span className="mono text-architect">{lead.lead_number}</span> to confirm
          </Label>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoFocus />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={!matches || busy}>
            {busy ? "Deleting…" : "Delete lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}