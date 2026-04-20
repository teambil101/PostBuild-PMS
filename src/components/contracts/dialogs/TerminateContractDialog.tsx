import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

const REASONS = [
  { value: "notice_by_pm", label: "Notice by PM" },
  { value: "notice_by_landlord", label: "Notice by landlord" },
  { value: "breach", label: "Breach" },
  { value: "mutual_agreement", label: "Mutual agreement" },
  { value: "non_performance", label: "Non-performance" },
  { value: "other", label: "Other" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string;
  startDate: string | null;
  subjectsCount: number;
  existingNotes: string | null;
  onTerminated?: () => void;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

export function TerminateContractDialog({
  open, onOpenChange, contractId, startDate, subjectsCount, existingNotes, onTerminated,
}: Props) {
  const [terminationDate, setTerminationDate] = useState(todayISO());
  const [reason, setReason] = useState<string>("notice_by_pm");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const dateInvalid = !!startDate && terminationDate < startDate;

  const handle = async () => {
    if (!terminationDate || !reason || dateInvalid) {
      toast.error("Fix the form before terminating.");
      return;
    }
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();

    const reasonLabel = REASONS.find((r) => r.value === reason)?.label ?? reason;
    const noteSuffix = notes.trim()
      ? `\n\n[Terminated ${terminationDate}] ${notes.trim()}`
      : `\n\n[Terminated ${terminationDate}] Reason: ${reasonLabel}`;
    const updatedNotes = (existingNotes ?? "") + noteSuffix;

    const { error } = await supabase
      .from("contracts")
      .update({
        status: "terminated",
        terminated_at: new Date(`${terminationDate}T00:00:00.000Z`).toISOString(),
        terminated_reason: reason,
        notes: updatedNotes.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", contractId);
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }
    await supabase.from("contract_events").insert({
      contract_id: contractId,
      event_type: "terminated",
      from_value: "active",
      to_value: "terminated",
      description: `Terminated: ${reasonLabel}${notes.trim() ? ` — ${notes.trim()}` : ""}`,
      actor_id: u.user?.id,
    });
    setSubmitting(false);
    toast.success("Contract terminated.");
    onOpenChange(false);
    onTerminated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Terminate this management agreement?</DialogTitle>
          <DialogDescription>This action will end your authority to manage these properties.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Termination date *</Label>
            <Input
              type="date"
              value={terminationDate}
              min={startDate ?? undefined}
              onChange={(e) => setTerminationDate(e.target.value)}
            />
            {dateInvalid && (
              <p className="text-[11px] text-destructive">Date cannot be before start date ({startDate}).</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Notes</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context for the termination, optional…"
            />
          </div>
          <div className="border hairline rounded-sm bg-amber-500/10 border-amber-500/30 p-3 flex gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 leading-relaxed">
              This will end your authority to manage {subjectsCount}{" "}
              {subjectsCount === 1 ? "property" : "properties"} listed under this contract.
              Any active leases on those properties will remain active — they are separate
              contracts and are not affected by terminating this management agreement.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button
            variant="default"
            onClick={handle}
            disabled={submitting || dateInvalid}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting ? "Terminating…" : "Terminate contract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}