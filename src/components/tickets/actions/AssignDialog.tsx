import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
  currentAssigneeId: string | null;
  onDone: () => void;
}

export function AssignDialog({ open, onOpenChange, ticketId, currentAssigneeId, onDone }: Props) {
  const { user: _user } = useAuth();
  const [people, setPeople] = useState<{ id: string; first_name: string; last_name: string; company: string | null; is_self: boolean }[]>([]);
  const [selectedId, setSelectedId] = useState<string>(currentAssigneeId ?? "__none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(currentAssigneeId ?? "__none");
    (async () => {
      const { data } = await supabase
        .from("people")
        .select("id, first_name, last_name, company, is_self")
        .order("first_name");
      setPeople(data ?? []);
    })();
  }, [open, currentAssigneeId]);

  const selfId = people.find((p) => p.is_self)?.id ?? null;

  const handleSubmit = async () => {
    const next = selectedId === "__none" ? null : selectedId;
    if (next === currentAssigneeId) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("tickets").update({ assignee_id: next }).eq("id", ticketId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Assigned." : "Unassigned.");
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign ticket</DialogTitle>
          <DialogDescription>Pick someone to own this ticket, or leave it unassigned.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Assignee</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__none">Unassigned</SelectItem>
              {selfId && <SelectItem value={selfId}>Assign to me</SelectItem>}
              {people
                .filter((p) => p.id !== selfId)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {`${p.first_name} ${p.last_name}`.trim()}
                    {p.company ? ` · ${p.company}` : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="gold" onClick={handleSubmit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
