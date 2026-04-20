import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
  ticketNumber: string;
  onDone: () => void;
}

export function DeleteTicketDialog({ open, onOpenChange, ticketId, ticketNumber, onDone }: Props) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setConfirm(""); }, [open]);

  const handleSubmit = async () => {
    if (confirm !== ticketNumber) {
      toast.error("Type the ticket number to confirm.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("tickets").delete().eq("id", ticketId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ticket deleted.");
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">Delete this ticket?</DialogTitle>
          <DialogDescription>
            This permanently removes the ticket and all its workflow steps, comments, and attachments.
            Type <span className="mono text-architect">{ticketNumber}</span> below to confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Confirm ticket number</Label>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={ticketNumber}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={busy || confirm !== ticketNumber}
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
