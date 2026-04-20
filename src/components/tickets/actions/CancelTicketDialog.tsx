import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
  onDone: () => void;
}

export function CancelTicketDialog({ open, onOpenChange, ticketId, onDone }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setReason(""); }, [open]);

  const handleSubmit = async () => {
    if (!reason.trim()) { toast.error("A reason is required."); return; }
    setBusy(true);
    const { error } = await supabase.from("tickets").update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_reason: reason.trim(),
    }).eq("id", ticketId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ticket cancelled.");
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this ticket?</DialogTitle>
          <DialogDescription>
            This marks the ticket cancelled. You can reopen it later if needed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Reason <span className="text-destructive">*</span></Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            placeholder="Why is this being cancelled?"
            className="min-h-[80px]"
            maxLength={500}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Keep open</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={busy || !reason.trim()}>
            {busy ? "Cancelling…" : "Cancel ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
