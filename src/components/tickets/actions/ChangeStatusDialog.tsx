import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  TICKET_STATUSES, TICKET_STATUS_LABELS, WAITING_ON, WAITING_ON_LABELS,
  type TicketStatus, type WaitingOn,
} from "@/lib/tickets";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
  currentStatus: TicketStatus;
  currentWaitingOn: string | null;
  onDone: () => void;
}

/** Allowed transitions per status. Closed/cancelled are terminal — use Reopen. */
const ALLOWED: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "awaiting", "resolved", "cancelled"],
  in_progress: ["open", "awaiting", "resolved", "cancelled"],
  awaiting: ["open", "in_progress", "resolved", "cancelled"],
  resolved: ["in_progress", "closed"],
  closed: [],
  cancelled: [],
};

export function ChangeStatusDialog({
  open, onOpenChange, ticketId, currentStatus, currentWaitingOn, onDone,
}: Props) {
  const [next, setNext] = useState<TicketStatus>(currentStatus);
  const [waitingOn, setWaitingOn] = useState<string | null>(currentWaitingOn);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setNext(currentStatus);
      setWaitingOn(currentWaitingOn);
      setNote("");
    }
  }, [open, currentStatus, currentWaitingOn]);

  const options = ALLOWED[currentStatus] ?? [];
  const needsWaitingOn = next === "awaiting";

  const handleSubmit = async () => {
    if (next === currentStatus && waitingOn === currentWaitingOn) {
      onOpenChange(false);
      return;
    }
    if (needsWaitingOn && !waitingOn) {
      toast.error("Pick what the ticket is waiting on.");
      return;
    }
    setBusy(true);
    const patch: Partial<{
      status: string;
      waiting_on: string | null;
      resolved_at: string | null;
      closed_at: string | null;
    }> = { status: next };
    if (needsWaitingOn) patch.waiting_on = waitingOn;
    if (next !== "awaiting") patch.waiting_on = null;
    if (next === "resolved") patch.resolved_at = new Date().toISOString();
    if (next === "closed") patch.closed_at = new Date().toISOString();

    const { error } = await supabase.from("tickets").update(patch as never).eq("id", ticketId);
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    if (note.trim()) {
      await supabase.from("ticket_events").insert({
        ticket_id: ticketId,
        event_type: "note",
        description: note.trim(),
      });
    }
    setBusy(false);
    toast.success(`Status changed to ${TICKET_STATUS_LABELS[next]}.`);
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change status</DialogTitle>
          <DialogDescription>
            Currently <span className="text-architect">{TICKET_STATUS_LABELS[currentStatus]}</span>.
            {options.length === 0 && " This ticket is closed — use Reopen instead."}
          </DialogDescription>
        </DialogHeader>

        {options.length > 0 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>New status</Label>
              <Select value={next} onValueChange={(v) => setNext(v as TicketStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {options.map((s) => (
                    <SelectItem key={s} value={s}>{TICKET_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsWaitingOn && (
              <div className="space-y-1.5">
                <Label>Waiting on</Label>
                <Select value={waitingOn ?? ""} onValueChange={setWaitingOn}>
                  <SelectTrigger><SelectValue placeholder="Pick…" /></SelectTrigger>
                  <SelectContent>
                    {WAITING_ON.map((w) => (
                      <SelectItem key={w} value={w}>{WAITING_ON_LABELS[w as WaitingOn]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                placeholder="Why this change?"
                className="min-h-[64px]"
                maxLength={500}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          {options.length > 0 && (
            <Button variant="gold" onClick={handleSubmit} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
