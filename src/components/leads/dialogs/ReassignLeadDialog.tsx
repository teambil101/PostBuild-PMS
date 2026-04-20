import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PersonCombobox, type PickedPerson } from "@/components/owners/PersonCombobox";
import { useAuth } from "@/contexts/AuthContext";
import type { LeadRow } from "@/lib/leads";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: LeadRow;
  onSaved: () => void;
}

export function ReassignLeadDialog({ open, onOpenChange, lead, onSaved }: Props) {
  const { user } = useAuth();
  const [assignee, setAssignee] = useState<PickedPerson | null>(null);
  const [currentLabel, setCurrentLabel] = useState<string>("Unassigned");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [selfPersonId, setSelfPersonId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNote("");
    if (lead.assignee_id) {
      supabase.from("people").select("id, first_name, last_name, company").eq("id", lead.assignee_id).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setAssignee(data as PickedPerson);
            setCurrentLabel(`${data.first_name} ${data.last_name}`.trim());
          }
        });
    } else {
      setAssignee(null);
      setCurrentLabel("Unassigned");
    }
    // Look up self_person_id for "Assign to me"
    supabase.from("app_settings").select("self_person_id").maybeSingle().then(({ data }) => {
      setSelfPersonId(data?.self_person_id ?? null);
    });
  }, [open, lead.assignee_id]);

  const assignToMe = async () => {
    if (!selfPersonId) {
      toast.error("No 'self' person configured. Set one in Settings first.");
      return;
    }
    const { data } = await supabase
      .from("people")
      .select("id, first_name, last_name, company")
      .eq("id", selfPersonId)
      .maybeSingle();
    if (data) setAssignee(data as PickedPerson);
  };

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("leads")
      .update({ assignee_id: assignee?.id ?? null })
      .eq("id", lead.id);
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    if (note.trim()) {
      await supabase.from("notes").insert({
        entity_type: "lead",
        entity_id: lead.id,
        body: note.trim(),
        author_id: user?.id,
      });
    }
    setBusy(false);
    toast.success("Lead reassigned.");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Reassign lead</DialogTitle>
          <DialogDescription>
            Currently assigned to <span className="font-medium text-architect">{currentLabel}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Assignee</Label>
              {selfPersonId && (
                <button
                  type="button"
                  onClick={assignToMe}
                  className="text-[11px] uppercase tracking-wider text-gold-deep hover:underline"
                >
                  Assign to me
                </button>
              )}
            </div>
            <PersonCombobox
              value={assignee?.id ?? ""}
              valueLabel={assignee ? `${assignee.first_name} ${assignee.last_name}`.trim() : ""}
              onChange={setAssignee}
              placeholder="Unassigned"
              roleFilter={["staff"]}
              hideAddNew
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="gold" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}