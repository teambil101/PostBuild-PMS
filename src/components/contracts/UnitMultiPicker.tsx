import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Building2, Search, Plus, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GlobalUnitFormDialog } from "@/components/properties/GlobalUnitFormDialog";
import { cn } from "@/lib/utils";

export interface PickedUnitSubject {
  subject_type: "unit";
  subject_id: string;
  label: string;
}

interface UnitRow {
  id: string;
  ref_code: string;
  unit_number: string;
  floor: number | null;
}

interface BuildingRow {
  id: string;
  ref_code: string;
  name: string;
  city: string;
  units: UnitRow[];
}

interface Props {
  value: PickedUnitSubject[];
  onChange: (next: PickedUnitSubject[]) => void;
}

/**
 * MA wizard property picker. Lists units grouped by building. Selecting a
 * building writes one subject per unit (no building subjects). Inline "+ New
 * unit" affordance.
 */
export function UnitMultiPicker({ value, onChange }: Props) {
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: b }, { data: u }] = await Promise.all([
      supabase.from("buildings").select("id, ref_code, name, city").order("name"),
      supabase
        .from("units")
        .select("id, ref_code, unit_number, floor, building_id")
        .order("unit_number"),
    ]);
    const byBuilding: Record<string, UnitRow[]> = {};
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
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedKeys = useMemo(() => new Set(value.map((s) => s.subject_id)), [value]);

  const toggleUnit = (b: BuildingRow, unit: UnitRow) => {
    if (selectedKeys.has(unit.id)) {
      onChange(value.filter((v) => v.subject_id !== unit.id));
    } else {
      onChange([
        ...value,
        {
          subject_type: "unit",
          subject_id: unit.id,
          label: `${unit.ref_code} — ${b.name} · ${unit.unit_number}`,
        },
      ]);
    }
  };

  const allSelectedFor = (b: BuildingRow) =>
    b.units.length > 0 && b.units.every((u) => selectedKeys.has(u.id));

  const someSelectedFor = (b: BuildingRow) =>
    b.units.some((u) => selectedKeys.has(u.id));

  const toggleAllFor = (b: BuildingRow) => {
    if (allSelectedFor(b)) {
      // remove all of this building's units
      const removeIds = new Set(b.units.map((u) => u.id));
      onChange(value.filter((v) => !removeIds.has(v.subject_id)));
    } else {
      // add any not yet selected
      const toAdd = b.units
        .filter((u) => !selectedKeys.has(u.id))
        .map<PickedUnitSubject>((u) => ({
          subject_type: "unit",
          subject_id: u.id,
          label: `${u.ref_code} — ${b.name} · ${u.unit_number}`,
        }));
      onChange([...value, ...toAdd]);
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
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search buildings or units…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          New unit
        </Button>
      </div>

      <div className="border hairline rounded-sm bg-card max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading units…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">No units found.</div>
        ) : (
          <ul className="divide-y hairline">
            {filtered.map((b) => {
              const isOpen = expanded.has(b.id);
              const allSelected = allSelectedFor(b);
              const someSelected = !allSelected && someSelectedFor(b);
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
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={() => toggleAllFor(b)}
                      disabled={b.units.length === 0}
                      aria-label={`Select all units in ${b.name}`}
                    />
                    <Building2 className="h-4 w-4 text-architect/60 shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-architect truncate">{b.name}</div>
                      <div className="mono text-[10px] text-muted-foreground">
                        {b.ref_code} · {b.city} · {b.units.length} units
                        {someSelected || allSelected ? (
                          <span className="ml-2 text-architect">
                            ({b.units.filter((u) => selectedKeys.has(u.id)).length} selected)
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {isOpen && b.units.length > 0 && (
                    <ul className="bg-muted/20 border-t hairline">
                      {b.units.map((u) => {
                        const checked = selectedKeys.has(u.id);
                        return (
                          <li key={u.id} className="flex items-center gap-2 pl-12 pr-3 py-1.5">
                            <Checkbox checked={checked} onCheckedChange={() => toggleUnit(b, u)} />
                            <Home className="h-3.5 w-3.5 text-architect/60 shrink-0" strokeWidth={1.5} />
                            <div className="text-xs text-architect">Unit {u.unit_number}</div>
                            <div className="mono text-[10px] text-muted-foreground">{u.ref_code}</div>
                            {u.floor !== null && (
                              <div className="text-[10px] text-muted-foreground">Floor {u.floor}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {isOpen && b.units.length === 0 && (
                    <div className="bg-muted/20 border-t hairline px-12 py-3 text-[11px] text-muted-foreground">
                      No units in this building yet.
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {value.length > 0 && (
        <div className="text-xs text-muted-foreground">{value.length} unit(s) selected</div>
      )}

      <GlobalUnitFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async (unitId) => {
          await load();
          // Auto-select the newly created unit
          const { data: u } = await supabase
            .from("units")
            .select("id, ref_code, unit_number, building_id, building:buildings(name)")
            .eq("id", unitId)
            .maybeSingle();
          if (u) {
            onChange([
              ...value,
              {
                subject_type: "unit",
                subject_id: u.id,
                label: `${u.ref_code} — ${(u as any).building?.name ?? "—"} · ${u.unit_number}`,
              },
            ]);
            setExpanded((prev) => new Set(prev).add(u.building_id));
          }
        }}
      />
    </div>
  );
}