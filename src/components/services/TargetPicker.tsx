import { useEffect, useMemo, useState } from "react";
import { Home, Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type TargetType = "unit" | "building" | "portfolio";

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
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (targetType !== "unit") onChange("unit", targetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const u = await supabase
        .from("units")
        .select("id,unit_number,ref_code,building_id,buildings(name)")
        .order("unit_number");
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return units;
    return units.filter(
      (u) =>
        u.unit_number.toLowerCase().includes(q) ||
        u.ref_code.toLowerCase().includes(q) ||
        u.building_name.toLowerCase().includes(q),
    );
  }, [units, search]);

  return (
    <div className="space-y-3">
      <div>
        <Label className="label-eyebrow text-muted-foreground">Pick the unit this work is for</Label>
        <p className="text-[11px] text-muted-foreground mt-1">
          Every job attaches to a unit. For common-area work (lobby, lift), attach it to a designated "Common Areas" unit on the building.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search by building, unit number, or ref code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="border hairline rounded-sm bg-card max-h-[360px] overflow-y-auto">
        {loading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading units…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">No units found.</div>
        ) : (
          <ul className="divide-y hairline">
            {filtered.map((u) => {
              const selected = targetId === u.id;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => onChange("unit", selected ? null : u.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                      selected ? "bg-muted/60" : "hover:bg-muted/30",
                    )}
                  >
                    <Home className="h-4 w-4 text-architect/60 shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-architect truncate">
                        {u.building_name} · Unit {u.unit_number}
                      </div>
                      <div className="mono text-[10px] text-muted-foreground">{u.ref_code}</div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}