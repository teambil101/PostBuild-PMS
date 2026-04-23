import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { UnitFormDialog } from "@/components/properties/UnitFormDialog";
import { BuildingFormDialog } from "@/components/properties/BuildingFormDialog";

interface BuildingOption {
  id: string;
  name: string;
  ref_code: string;
  building_type: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (unitId: string) => void;
}

/**
 * Two-step "global" unit creator: pick (or create) a building, then open the
 * existing per-building UnitFormDialog. Used by inline "+ New unit" affordances
 * outside of the building detail page.
 */
export function GlobalUnitFormDialog({ open, onOpenChange, onCreated }: Props) {
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [chosenBuildingId, setChosenBuildingId] = useState<string>("");
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("buildings")
      .select("id, name, ref_code, building_type")
      .order("name");
    setBuildings((data ?? []) as BuildingOption[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      void load();
      setChosenBuildingId("");
    }
  }, [open]);

  const chosen = buildings.find((b) => b.id === chosenBuildingId) ?? null;

  return (
    <>
      <Dialog
        open={open && !unitDialogOpen}
        onOpenChange={(v) => {
          if (!v) onOpenChange(false);
        }}
      >
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">New unit</DialogTitle>
            <DialogDescription>Pick the building this unit belongs to.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div>
              <Label>Building</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Select value={chosenBuildingId} onValueChange={setChosenBuildingId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={loading ? "Loading…" : "Pick a building"} />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}{" "}
                        <span className="text-muted-foreground ml-2 text-xs mono">{b.ref_code}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={() => setBuildingDialogOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  New
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Buildings group units. Day-to-day work attaches to a unit.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="gold"
                disabled={!chosenBuildingId}
                onClick={() => setUnitDialogOpen(true)}
              >
                Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {chosen && (
        <UnitFormDialog
          open={unitDialogOpen}
          onOpenChange={(v) => {
            setUnitDialogOpen(v);
            if (!v) {
              // also close the wrapper unless the user goes back
              onOpenChange(false);
            }
          }}
          onSaved={(created) => {
            setUnitDialogOpen(false);
            onOpenChange(false);
            if (created?.id) onCreated(created.id);
          }}
          buildingId={chosen.id}
          parentBuildingType={chosen.building_type}
        />
      )}

      <BuildingFormDialog
        open={buildingDialogOpen}
        onOpenChange={setBuildingDialogOpen}
        onSaved={() => {
          setBuildingDialogOpen(false);
          void load();
        }}
      />
    </>
  );
}