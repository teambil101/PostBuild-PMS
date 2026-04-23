import { useEffect, useMemo, useState } from "react";
import { Search, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PickedUnit {
  id: string;
  unit_number: string;
  ref_code: string;
  building_id: string;
  building_name: string;
  status: string;
  asking_rent: number | null;
  asking_rent_currency: string | null;
}

interface Props {
  value: PickedUnit | null;
  onChange: (next: PickedUnit | null) => void;
}

export function UnitPicker({ value, onChange }: Props) {
  const [units, setUnits] = useState<PickedUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("units")
        .select("id, unit_number, ref_code, building_id, status, asking_rent, asking_rent_currency, building:buildings(name)")
        .order("ref_code");
      setUnits(
        (data ?? []).map((u: any) => ({
          id: u.id,
          unit_number: u.unit_number,
          ref_code: u.ref_code,
          building_id: u.building_id,
          building_name: u.building?.name ?? "—",
          status: u.status,
          asking_rent: u.asking_rent,
          asking_rent_currency: u.asking_rent_currency,
        })),
      );
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
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search by building, unit number, ref code…"
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
              const selected = value?.id === u.id;
              const isOccupied = u.status === "occupied";
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => onChange(selected ? null : u)}
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
                    <div className="text-right shrink-0">
                      <div
                        className={cn(
                          "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border hairline",
                          isOccupied
                            ? "text-status-occupied border-status-occupied/40 bg-status-occupied/5"
                            : "text-muted-foreground",
                        )}
                      >
                        {u.status.replace(/_/g, " ")}
                      </div>
                      {u.asking_rent && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Asking {u.asking_rent_currency} {u.asking_rent.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {value && (
        <div className="text-xs text-muted-foreground">
          Selected: <span className="text-architect">{value.building_name} · Unit {value.unit_number}</span>
          {value.status === "occupied" && (
            <span className="ml-2 text-amber-700">⚠ Already occupied — confirm you intend to override or end the existing lease first.</span>
          )}
        </div>
      )}
    </div>
  );
}
