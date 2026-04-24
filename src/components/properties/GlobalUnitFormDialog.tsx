import { useEffect, useState } from "react";
import { Plus, ChevronLeft } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ComboboxFree } from "@/components/ui/combobox-free";
import { supabase } from "@/integrations/supabase/client";
import { UnitFormDialog } from "@/components/properties/UnitFormDialog";
import { toast } from "sonner";
import { newBuildingCode } from "@/lib/refcode";
import { BUILDING_TYPES, COUNTRIES, UAE_CITIES, UAE_COMMUNITIES } from "@/lib/countries";
import { cn } from "@/lib/utils";

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

type Mode = "pick" | "create";

interface NewBuildingForm {
  name: string;
  building_type: string;
  building_type_other: string;
  community: string;
  city: string;
  country: string;
}

const emptyBuilding = (): NewBuildingForm => ({
  name: "",
  building_type: "residential_tower",
  building_type_other: "",
  community: "",
  city: "Dubai",
  country: "AE",
});

/**
 * Single-popup "global" unit creator: pick an existing building OR fill new
 * building fields inline, then continue to the unit form. Used by inline
 * "+ New unit" affordances outside of the building detail page.
 */
export function GlobalUnitFormDialog({ open, onOpenChange, onCreated }: Props) {
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("pick");
  const [chosenBuildingId, setChosenBuildingId] = useState<string>("");
  const [newBuilding, setNewBuilding] = useState<NewBuildingForm>(emptyBuilding());
  const [savingBuilding, setSavingBuilding] = useState(false);
  const [createdBuilding, setCreatedBuilding] = useState<BuildingOption | null>(null);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);

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
      setMode("pick");
      setChosenBuildingId("");
      setNewBuilding(emptyBuilding());
      setCreatedBuilding(null);
    }
  }, [open]);

  const chosen = createdBuilding ?? buildings.find((b) => b.id === chosenBuildingId) ?? null;

  const cityOptions = newBuilding.country === "AE" ? UAE_CITIES : [];
  const communityOptions = newBuilding.country === "AE" ? UAE_COMMUNITIES : [];

  const canContinue =
    mode === "pick"
      ? !!chosenBuildingId
      : newBuilding.name.trim().length >= 2 &&
        !!newBuilding.building_type &&
        (newBuilding.building_type !== "other" || newBuilding.building_type_other.trim().length > 0) &&
        newBuilding.city.trim().length > 0 &&
        /^[A-Z]{2}$/.test(newBuilding.country);

  const handleContinue = async () => {
    if (mode === "pick") {
      if (!chosenBuildingId) return;
      setUnitDialogOpen(true);
      return;
    }
    // Create the building first, then move on to unit form
    if (savingBuilding) return;
    setSavingBuilding(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = {
      name: newBuilding.name.trim(),
      building_type: newBuilding.building_type,
      building_type_other:
        newBuilding.building_type === "other" ? newBuilding.building_type_other.trim() || null : null,
      community: newBuilding.community.trim() || null,
      city: newBuilding.city.trim(),
      country: newBuilding.country,
      ref_code: newBuildingCode(),
      created_by: u.user?.id,
    };
    const { data, error } = await supabase
      .from("buildings")
      .insert(payload)
      .select("id, name, ref_code, building_type")
      .maybeSingle();
    setSavingBuilding(false);
    if (error || !data) {
      toast.error(error?.message ?? "Failed to create building.");
      return;
    }
    toast.success("Building added");
    setCreatedBuilding(data as BuildingOption);
    setUnitDialogOpen(true);
  };

  const labelClass = "text-xs font-medium text-architect normal-case tracking-normal";

  return (
    <>
      <Dialog
        open={open && !unitDialogOpen}
        onOpenChange={(v) => {
          if (!v) onOpenChange(false);
        }}
      >
        <DialogContent className="max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">New unit</DialogTitle>
            <DialogDescription>
              {mode === "pick"
                ? "Pick the building this unit belongs to, or add a new one."
                : "Add a new building, then we'll continue with the unit details."}
            </DialogDescription>
          </DialogHeader>

          {mode === "pick" ? (
            <div className="space-y-3 pt-2">
              <div>
                <Label className={labelClass}>Building</Label>
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
                  <Button type="button" variant="outline" size="sm" onClick={() => setMode("create")}>
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
                  disabled={!canContinue}
                  onClick={handleContinue}
                >
                  Continue
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <button
                type="button"
                onClick={() => setMode("pick")}
                className="inline-flex items-center gap-1 text-xs text-true-taupe hover:text-architect"
              >
                <ChevronLeft className="h-3 w-3" />
                Back to pick existing
              </button>

              <div>
                <Label htmlFor="gb-name" className={labelClass}>
                  Building name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="gb-name"
                  value={newBuilding.name}
                  onChange={(e) => setNewBuilding((b) => ({ ...b, name: e.target.value }))}
                  placeholder="e.g. Marina Heights Tower"
                  maxLength={120}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="gb-type" className={labelClass}>
                  Building type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={newBuilding.building_type}
                  onValueChange={(v) => setNewBuilding((b) => ({ ...b, building_type: v }))}
                >
                  <SelectTrigger id="gb-type" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUILDING_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {newBuilding.building_type === "other" && (
                <div>
                  <Label htmlFor="gb-type-other" className={labelClass}>
                    Describe building type <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="gb-type-other"
                    value={newBuilding.building_type_other}
                    onChange={(e) => setNewBuilding((b) => ({ ...b, building_type_other: e.target.value }))}
                    maxLength={80}
                    className="mt-1.5"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="gb-community" className={labelClass}>Community</Label>
                <div className="mt-1.5">
                  <ComboboxFree
                    id="gb-community"
                    value={newBuilding.community}
                    onChange={(v) => setNewBuilding((b) => ({ ...b, community: v }))}
                    options={communityOptions}
                    placeholder="Search or type a community"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="gb-city" className={labelClass}>
                    City <span className="text-destructive">*</span>
                  </Label>
                  <div className="mt-1.5">
                    <ComboboxFree
                      id="gb-city"
                      value={newBuilding.city}
                      onChange={(v) => setNewBuilding((b) => ({ ...b, city: v }))}
                      options={cityOptions}
                      placeholder={cityOptions.length ? "Search or type" : "Type a city"}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="gb-country" className={labelClass}>
                    Country <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={newBuilding.country}
                    onValueChange={(v) =>
                      setNewBuilding((b) => ({
                        ...b,
                        country: v,
                        city: v === "AE" && !b.city ? "Dubai" : b.city,
                      }))
                    }
                  >
                    <SelectTrigger id="gb-country" className={cn("mt-1.5")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="gold"
                  disabled={!canContinue || savingBuilding}
                  onClick={handleContinue}
                >
                  {savingBuilding ? "Saving…" : "Continue to unit details"}
                </Button>
              </div>
            </div>
          )}
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
    </>
  );
}