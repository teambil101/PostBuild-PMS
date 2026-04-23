import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Building2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface PickedSubject {
  subject_type: "building" | "unit";
  subject_id: string;
  label: string;
}

interface BuildingRow {
  id: string;
  ref_code: string;
  name: string;
  city: string;
  units: { id: string; ref_code: string; unit_number: string; floor: number | null }[];
}

interface Props {
  value: PickedSubject[];
  onChange: (next: PickedSubject[]) => void;
}

export function PropertyPicker({ value, onChange }: Props) {
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: b } = await supabase
        .from("buildings")
        .select("id, ref_code, name, city")
        .order("name");
      const { data: u } = await supabase
        .from("units")
        .select("id, ref_code, unit_number, floor, building_id")
        .order("unit_number");
      const byBuilding: Record<string, BuildingRow["units"]> = {};
      (u ?? []).forEach((unit: any) => {
        (byBuilding[unit.building_id] ||= []).push(unit);
      });
      setBuildings(
        (b ?? []).map((row: any) => ({
          ...row,
          units: byBuilding[row.id] ?? [],
        })),
      );
      setLoading(false);
    })();
  }, []);

  const selectedKeys = useMemo(() => new Set(value.map((s) => `${s.subject_type}:${s.subject_id}`)), [value]);

  const toggleSubject = (subj: PickedSubject) => {
    const k = `${subj.subject_type}:${subj.subject_id}`;
    if (selectedKeys.has(k)) {
      onChange(value.filter((v) => `${v.subject_type}:${v.subject_id}` !== k));
    } else {
      onChange([...value, subj]);
    }
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buildings;
    return buildings.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.ref_code.toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q) ||
        b.units.some((u) => u.unit_number.toLowerCase().includes(q) || u.ref_code.toLowerCase().includes(q)),
    );
  }, [buildings, search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search buildings or units…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="border hairline rounded-sm bg-card max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading properties…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">No properties found.</div>
        ) : (
          <ul className="divide-y hairline">
            {filtered.map((b) => {
              const buildingKey = `building:${b.id}`;
              const buildingChecked = selectedKeys.has(buildingKey);
              const isOpen = expanded.has(b.id);
              return (
                <li key={b.id}>
                  <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/30">
                    <button
                      type="button"
                      onClick={() => toggleExpand(b.id)}
                      className="text-muted-foreground hover:text-architect"
                      aria-label={isOpen ? "Collapse" : "Expand"}
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <Checkbox
                      checked={buildingChecked}
                      onCheckedChange={() =>
                        toggleSubject({
                          subject_type: "building",
                          subject_id: b.id,
                          label: `${b.ref_code} — ${b.name}`,
                        })
                      }
                    />
                    <Building2 className="h-4 w-4 text-architect/60 shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-architect truncate">{b.name}</div>
                      <div className="mono text-[10px] text-muted-foreground">{b.ref_code} · {b.city} · {b.units.length} units</div>
                    </div>
                  </div>
                  {isOpen && b.units.length > 0 && (
                    <ul className="bg-muted/20 border-t hairline">
                      {b.units.map((u) => {
                        const k = `unit:${u.id}`;
                        const checked = selectedKeys.has(k) || buildingChecked;
                        return (
                          <li
                            key={u.id}
                            className={cn(
                              "flex items-center gap-2 pl-12 pr-3 py-1.5",
                              buildingChecked && "opacity-60",
                            )}
                          >
                            <Checkbox
                              disabled={buildingChecked}
                              checked={checked}
                              onCheckedChange={() =>
                                toggleSubject({
                                  subject_type: "unit",
                                  subject_id: u.id,
                                  label: `${u.ref_code} — ${b.name} · ${u.unit_number}`,
                                })
                              }
                            />
                            <div className="text-xs text-architect">Unit {u.unit_number}</div>
                            <div className="mono text-[10px] text-muted-foreground">{u.ref_code}</div>
                            {u.floor !== null && <div className="text-[10px] text-muted-foreground">Floor {u.floor}</div>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {value.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {value.length} selected · {value.filter((v) => v.subject_type === "building").length} building(s),{" "}
          {value.filter((v) => v.subject_type === "unit").length} unit(s)
        </div>
      )}
    </div>
  );
}