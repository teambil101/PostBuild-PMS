import { useState } from "react";
import { toast } from "sonner";
import { Coins, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  ticketId: string;
  estimatedCost: number | null;
  currency: string;
  selfPersonId: string | null;
  onDone: () => void;
}

export function CostApprovalBanner({ ticketId, estimatedCost, currency, selfPersonId, onDone }: Props) {
  const { canEdit } = useAuth();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [openReject, setOpenReject] = useState(false);

  const update = async (status: "approved" | "rejected") => {
    setBusy(true);
    const { error } = await supabase.from("tickets").update({
      cost_approval_status: status,
      cost_approval_notes: notes.trim() || null,
      cost_approved_by_person_id: selfPersonId,
      cost_approved_at: new Date().toISOString(),
    }).eq("id", ticketId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "Cost approved." : "Cost rejected.");
    setOpenReject(false);
    setNotes("");
    onDone();
  };

  return (
    <div className="border border-amber-500/40 bg-amber-500/5 rounded-sm p-4 flex items-start gap-3">
      <Coins className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-architect">Cost approval pending</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {estimatedCost != null
            ? `Estimated ${currency} ${Number(estimatedCost).toLocaleString()} exceeds the repair threshold (or none is set).`
            : "Estimated cost not provided yet."}
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-2 shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy}>
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-2">
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                className="min-h-[64px] text-xs"
                placeholder="Anything to record?"
                maxLength={500}
              />
              <Button variant="gold" size="sm" className="w-full" onClick={() => update("approved")} disabled={busy}>
                Confirm approve
              </Button>
            </PopoverContent>
          </Popover>
          <Popover open={openReject} onOpenChange={setOpenReject}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy}>
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-2">
              <Label className="text-xs">Reason</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                className="min-h-[64px] text-xs"
                placeholder="Why are you rejecting?"
                maxLength={500}
                autoFocus
              />
              <Button variant="destructive" size="sm" className="w-full" onClick={() => update("rejected")} disabled={busy || !notes.trim()}>
                Confirm reject
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
