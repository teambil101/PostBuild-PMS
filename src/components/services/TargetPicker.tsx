import { useEffect, useState } from "react";
import { Building2, Home, Layers } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type TargetType = "unit" | "building" | "portfolio";

interface Building {
  id: string;
  name: string;
  ref_code: string;
  city: string;
}

interface Unit {
  id: string;
  unit_number: string;
  ref_code: string;
  building_id: string;
  building_name: string;
}

interface Props {
  targetType: TargetType;
  targetId: string | null;
  onChange: (type: TargetType, id: string | null) => void;
}

export function TargetPicker({ targetType, targetId, onChange }: Props) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [b, u] = await Promise.all([
        supabase.from("buildings").select("id,name,ref_code,city").order("name"),
        supabase
          .from("units")
          .select("id,unit_number,ref_code,building_id,buildings(name)")
          .order("unit_number"),
      ]);
      if (b.data) setBuildings(b.data as any);
      if (u.data) {
        setUnits(
          (u.data as any[]).map((row) => ({
            id: row.id,
            unit_number: row.unit_number,
            ref_code: row.ref_code,
            building_id: row.building_id,
            building_name: row.buildings?.name ?? "—",
          })),
        );
      }
      setLoading(false);
    })();
  }, []);

  const TYPES: { key: TargetType; label: string; icon: any; hint: string }[] = [
    { key: "unit", label: "A unit", icon: Home, hint: "AC repair, cleaning, inspection" },
    { key: "building", label: "A building", icon: Building2, hint: "Common area, lobby, lift" },
    { key: "portfolio", label: "Portfolio-level", icon: Layers, hint: "Admin / cross-property" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <Label className="label-eyebrow text-muted-foreground">What is this for?</Label>
        <div className="grid md:grid-cols-3 gap-2 mt-2">
          {TYPES.map((t) => {
            const Icon = t.icon;
            const active = targetType === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onChange(t.key, null)}
                className={cn(
                  "border hairline rounded-sm p-3 text-left transition-colors",
                  active ? "border-architect bg-architect/5" : "hover:bg-muted/40",
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", active ? "text-architect" : "text-muted-foreground")} />
                  <span className="text-sm text-architect">{t.label}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">{t.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      {targetType === "unit" && (
        <div>
          <Label>Unit</Label>
          <Select value={targetId ?? ""} onValueChange={(v) => onChange("unit", v)}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder={loading ? "Loading…" : "Pick a unit"} />
            </SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.building_name} · {u.unit_number} <span className="text-muted-foreground ml-2 text-xs">{u.ref_code}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {targetType === "building" && (
        <div>
          <Label>Building</Label>
          <Select value={targetId ?? ""} onValueChange={(v) => onChange("building", v)}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder={loading ? "Loading…" : "Pick a building"} />
            </SelectTrigger>
            <SelectContent>
              {buildings.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name} <span className="text-muted-foreground ml-2 text-xs">{b.city} · {b.ref_code}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {targetType === "portfolio" && (
        <div className="border hairline rounded-sm bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Portfolio-level requests aren't tied to a specific property — useful for admin tasks (e.g. annual audit, broker outreach).
        </div>
      )}
    </div>
  );
}