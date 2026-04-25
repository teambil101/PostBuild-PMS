import { useEffect, useState } from "react";
import { Plus, ChevronLeft } from "lucide-react";
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

const labelClass = "text-xs font-medium text-architect normal-case tracking-normal";

/**
 * Single-popup "global" unit creator. Building selection (existing or new
 * inline) and full unit details live in the SAME dialog — no two-step flow.
 * The building is created (if new) right before the unit is inserted.
 */
export function GlobalUnitFormDialog({ open, onOpenChange, onCreated }: Props) {
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("pick");
  const [chosenBuildingId, setChosenBuildingId] = useState<string>("");
  const [newBuilding, setNewBuilding] = useState<NewBuildingForm>(emptyBuilding());

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
    }
  }, [open]);

  const chosen = buildings.find((b) => b.id === chosenBuildingId) ?? null;

  const cityOptions = newBuilding.country === "AE" ? UAE_CITIES : [];
  const communityOptions = newBuilding.country === "AE" ? UAE_COMMUNITIES : [];

  // Effective building type used by the unit form (drives type/floor options)
  const effectiveBuildingType =
    mode === "pick"
      ? chosen?.building_type ?? "residential_tower"
      : newBuilding.building_type === "other"
        ? "residential_tower"
        : newBuilding.building_type;

  // Validation for the building section (per mode).
  const buildingSectionValid =
    mode === "pick"
      ? !!chosenBuildingId
      : newBuilding.name.trim().length >= 2 &&
        !!newBuilding.building_type &&
        (newBuilding.building_type !== "other" || newBuilding.building_type_other.trim().length > 0) &&
        newBuilding.city.trim().length > 0 &&
        /^[A-Z]{2}$/.test(newBuilding.country);

  const beforeSave = async () => {
    if (!buildingSectionValid) {
      toast.error(
        mode === "pick"
          ? "Pick a building first."
          : "Fill in the required building fields first.",
      );
      return null;
    }
    if (mode === "pick") {
      return { buildingId: chosenBuildingId, buildingType: chosen?.building_type };
    }
    // Create the building first
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
    if (error || !data) {
      toast.error(error?.message ?? "Failed to create building.");
      return null;
    }
    toast.success("Building added");
    return { buildingId: data.id, buildingType: data.building_type };
  };

  // Building section rendered inline at the top of the unit form
  const topSlot = (
    <div className="border hairline rounded-sm bg-muted/20 p-4 space-y-3">
      <div className="text-sm font-medium text-architect">Building</div>

      {mode === "pick" ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
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
          <p className="text-[11px] text-muted-foreground">
            Buildings group units. Day-to-day work attaches to a unit.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setMode("pick")}
            className="inline-flex items-center gap-1 text-xs text-true-taupe hover:text-architect"
          >
            <ChevronLeft className="h-3 w-3" />
            Pick existing instead
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
        </div>
      )}
    </div>
  );

  // Use a synthetic buildingId on first mount when nothing is picked yet — the
  // UnitFormDialog needs *some* string to call its uniqueness check, but that
  // check only matters once the user is about to submit. We pass the chosen id
  // when available; otherwise an empty string is harmless because beforeSave
  // resolves the real id before the insert.
  return (
    <UnitFormDialog
      open={open}
      onOpenChange={onOpenChange}
      onSaved={(created) => {
        onOpenChange(false);
        if (created?.id) onCreated(created.id);
      }}
      buildingId={chosenBuildingId || "00000000-0000-0000-0000-000000000000"}
      parentBuildingType={effectiveBuildingType}
      topSlot={topSlot}
      titleOverride="New unit"
      descriptionOverride="Pick or add the building, then fill in the unit details."
      beforeSave={beforeSave}
    />
  );
}
