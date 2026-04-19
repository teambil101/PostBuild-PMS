import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  personId: string;
}

interface BuildingOption {
  id: string;
  name: string;
  ref_code: string;
  units: { id: string; unit_number: string; ref_code: string }[];
}

export function LinkToPropertyDialog({ open, onOpenChange, onSaved, personId }: Props) {
  const [busy, setBusy] = useState(false);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [buildingId, setBuildingId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [relationship, setRelationship] = useState("Occupant");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("buildings")
        .select("id, name, ref_code, units(id, unit_number, ref_code)")
        .order("name");
      setBuildings((data ?? []) as BuildingOption[]);
    })();
    setBuildingId(""); setUnitId(""); setRelationship("Occupant"); setStartDate(""); setEndDate("");
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buildingId) {
      toast.error("Pick a building.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("people_property_links").insert({
      person_id: personId,
      building_id: buildingId,
      unit_id: unitId || null,
      relationship,
      start_date: startDate || null,
      end_date: endDate || null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Linked."); onSaved(); }
  };

  const selectedBuilding = buildings.find((b) => b.id === buildingId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Link to property</DialogTitle>
          <DialogDescription>Connect this person to a building or unit.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Building *</Label>
            <Select value={buildingId} onValueChange={(v) => { setBuildingId(v); setUnitId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select a building" /></SelectTrigger>
              <SelectContent>
                {buildings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name} · {b.ref_code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedBuilding && selectedBuilding.units.length > 0 && (
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Unit (optional)</Label>
              <Select value={unitId || "__none"} onValueChange={(v) => setUnitId(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Building-wide" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Building-wide</SelectItem>
                  {selectedBuilding.units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>Unit {u.unit_number} · {u.ref_code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="label-eyebrow">Relationship *</Label>
            <Input value={relationship} onChange={(e) => setRelationship(e.target.value)} required placeholder="e.g. Occupant, Owner, Property manager" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">End date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Saving…" : "Add link"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
