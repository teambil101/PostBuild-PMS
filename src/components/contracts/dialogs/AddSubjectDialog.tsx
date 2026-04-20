import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SubjectPicker, type PickedSubject } from "@/components/contracts/SubjectPicker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string;
  existingKeys: string[]; // `${entity_type}:${entity_id}`
  onAdded?: () => void;
}

export function AddSubjectDialog({ open, onOpenChange, contractId, existingKeys, onAdded }: Props) {
  const [picked, setPicked] = useState<PickedSubject[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setPicked([]);
  }, [open]);

  const handle = async () => {
    const fresh = picked.filter((s) => !existingKeys.includes(`${s.entity_type}:${s.entity_id}`));
    if (fresh.length === 0) {
      toast.error("Pick at least one new property.");
      return;
    }
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    const rows = fresh.map((s) => ({
      contract_id: contractId,
      entity_type: s.entity_type,
      entity_id: s.entity_id,
      role: "subject",
    }));
    const { error } = await supabase.from("contract_subjects").insert(rows);
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }
    await supabase.from("contract_events").insert({
      contract_id: contractId,
      event_type: "subject_added",
      description: `Added ${fresh.length} ${fresh.length === 1 ? "property" : "properties"}: ${fresh.map((s) => s.label).join(", ")}`,
      actor_id: u.user?.id,
    });
    setSubmitting(false);
    toast.success(`${fresh.length} added.`);
    onOpenChange(false);
    onAdded?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add properties to this contract</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <SubjectPicker selected={picked} onChange={setPicked} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button variant="gold" onClick={handle} disabled={submitting || picked.length === 0}>
            {submitting ? "Adding…" : `Add ${picked.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}