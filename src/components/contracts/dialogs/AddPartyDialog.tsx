import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PersonCombobox, type PickedPerson } from "@/components/owners/PersonCombobox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PARTY_ROLES } from "@/lib/contracts";
import { formatEnumLabel } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string;
  excludePersonIds?: string[];
  onAdded?: () => void;
}

export function AddPartyDialog({ open, onOpenChange, contractId, excludePersonIds = [], onAdded }: Props) {
  const [person, setPerson] = useState<PickedPerson | null>(null);
  const [role, setRole] = useState<string>("witness");
  const [signatory, setSignatory] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setPerson(null);
    setRole("witness");
    setSignatory(true);
  };

  const handle = async () => {
    if (!person) {
      toast.error("Pick a person.");
      return;
    }
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("contract_parties").insert({
      contract_id: contractId,
      person_id: person.id,
      role,
      is_signatory: signatory,
    });
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }
    const name = person.company || `${person.first_name} ${person.last_name}`.trim();
    await supabase.from("contract_events").insert({
      contract_id: contractId,
      event_type: "party_added",
      to_value: role,
      description: `Added ${name} as ${formatEnumLabel(role)}`,
      actor_id: u.user?.id,
    });
    setSubmitting(false);
    toast.success("Party added.");
    reset();
    onOpenChange(false);
    onAdded?.();
  };

  const personLabel = person ? person.company || `${person.first_name} ${person.last_name}`.trim() : "";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add party</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Person *</Label>
            <PersonCombobox
              value={person?.id ?? ""}
              valueLabel={personLabel}
              onChange={(p) => setPerson(p)}
              excludeIds={excludePersonIds}
              placeholder="Search or add a person…"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Role *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PARTY_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{formatEnumLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between border hairline rounded-sm p-3 bg-card">
            <Label className="text-sm text-architect">Is signatory</Label>
            <Switch checked={signatory} onCheckedChange={setSignatory} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button variant="gold" onClick={handle} disabled={submitting || !person}>
            {submitting ? "Adding…" : "Add party"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}