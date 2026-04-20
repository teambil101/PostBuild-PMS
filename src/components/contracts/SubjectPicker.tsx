import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Home, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PickedSubject {
  entity_type: "building" | "unit";
  entity_id: string;
  label: string;
  building_name?: string;
}

interface Props {
  selected: PickedSubject[];
  onChange: (next: PickedSubject[]) => void;
  /** When set, shows a "Show only properties owned by this landlord" toggle that auto-filters. */
  landlordPersonId?: string | null;
  landlordName?: string | null;
}

interface BuildingRow { id: string; name: string; ref_code: string; city: string; }
interface UnitRow { id: string; unit_number: string; ref_code: string; building_id: string; building_name: string; }

export function SubjectPicker({ selected, onChange, landlordPersonId, landlordName }: Props) {
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterByLandlord, setFilterByLandlord] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [bRes, uRes] = await Promise.all([
        supabase.from("buildings").select("id, name, ref_code, city").order("name"),
        supabase
          .from("units")
          .select("id, unit_number, ref_code, building_id, buildings!inner(name)")
          .order("unit_number"),
      ]);
      setBuildings((bRes.data ?? []) as BuildingRow[]);
      setUnits(
        ((uRes.data ?? []) as any[]).map((u) => ({
          id: u.id,
          unit_number: u.unit_number,
          ref_code: u.ref_code,
          building_id: u.building_id,
          building_name: u.buildings?.name ?? "—",
        })),
      );
      setLoading(false);
    })();
  }, []);

  const [landlordOwnedBuildings, setLandlordOwnedBuildings] = useState<Set<string>>(new Set());
  const [landlordOwnedUnits, setLandlordOwnedUnits] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!landlordPersonId) {
      setLandlordOwnedBuildings(new Set());
      setLandlordOwnedUnits(new Set());
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("property_owners")
        .select("entity_type, entity_id")
        .eq("person_id", landlordPersonId);
      const b = new Set<string>(), u = new Set<string>();
      (data ?? []).forEach((r: any) => {
        if (r.entity_type === "building") b.add(r.entity_id);
        if (r.entity_type === "unit") u.add(r.entity_id);
      });
      setLandlordOwnedBuildings(b);
      setLandlordOwnedUnits(u);
    })();
  }, [landlordPersonId]);

  const filteredBuildings = useMemo(() => {
    let list = buildings;
    if (filterByLandlord && landlordPersonId) list = list.filter((b) => landlordOwnedBuildings.has(b.id));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((b) => b.name.toLowerCase().includes(q) || b.ref_code.toLowerCase().includes(q));
    }
    return list;
  }, [buildings, filterByLandlord, landlordPersonId, landlordOwnedBuildings, search]);

  const filteredUnits = useMemo(() => {
    let list = units;
    if (filterByLandlord && landlordPersonId) list = list.filter((u) => landlordOwnedUnits.has(u.id));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.unit_number.toLowerCase().includes(q) ||
          u.ref_code.toLowerCase().includes(q) ||
          u.building_name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [units, filterByLandlord, landlordPersonId, landlordOwnedUnits, search]);

  const isSelected = (type: "building" | "unit", id: string) =>
    selected.some((s) => s.entity_type === type && s.entity_id === id);

  const toggle = (s: PickedSubject) => {
    if (isSelected(s.entity_type, s.entity_id)) {
      onChange(selected.filter((x) => !(x.entity_type === s.entity_type && x.entity_id === s.entity_id)));
    } else {
      onChange([...selected, s]);
    }
  };

  const remove = (type: "building" | "unit", id: string) =>
    onChange(selected.filter((x) => !(x.entity_type === type && x.entity_id === id)));

  // Group units by building for display
  const unitsByBuilding = useMemo(() => {
    const map = new Map<string, UnitRow[]>();
    filteredUnits.forEach((u) => {
      if (!map.has(u.building_id)) map.set(u.building_id, []);
      map.get(u.building_id)!.push(u);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const an = a[1][0]?.building_name ?? "";
      const bn = b[1][0]?.building_name ?? "";
      return an.localeCompare(bn);
    });
  }, [filteredUnits]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Input
          placeholder="Search buildings or units…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        {landlordPersonId && (
          <label className="flex items-center gap-2 text-xs text-architect cursor-pointer whitespace-nowrap">
            <Checkbox
              checked={filterByLandlord}
              onCheckedChange={(v) => setFilterByLandlord(!!v)}
            />
            Show only owned by {landlordName ?? "landlord"}
          </label>
        )}
      </div>

      <Tabs defaultValue="buildings">
        <TabsList>
          <TabsTrigger value="buildings">
            <Building2 className="h-3.5 w-3.5 mr-1.5" /> Buildings ({filteredBuildings.length})
          </TabsTrigger>
          <TabsTrigger value="units">
            <Home className="h-3.5 w-3.5 mr-1.5" /> Units ({filteredUnits.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="buildings" className="mt-3">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : filteredBuildings.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">No buildings match.</div>
          ) : (
            <div className="border hairline rounded-sm bg-card max-h-72 overflow-y-auto">
              {filteredBuildings.map((b) => {
                const sel = isSelected("building", b.id);
                return (
                  <label
                    key={b.id}
                    className="flex items-center gap-3 px-3 py-2.5 border-b hairline last:border-0 hover:bg-muted/30 cursor-pointer"
                  >
                    <Checkbox
                      checked={sel}
                      onCheckedChange={() =>
                        toggle({ entity_type: "building", entity_id: b.id, label: b.name })
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-architect truncate">{b.name}</div>
                      <div className="text-[11px] text-muted-foreground mono">
                        {b.ref_code} · {b.city}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="units" className="mt-3">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">No units match.</div>
          ) : (
            <div className="border hairline rounded-sm bg-card max-h-72 overflow-y-auto">
              {unitsByBuilding.map(([bid, list]) => (
                <div key={bid}>
                  <div className="label-eyebrow px-3 py-1.5 bg-muted/40 border-b hairline">
                    {list[0].building_name}
                  </div>
                  {list.map((u) => {
                    const sel = isSelected("unit", u.id);
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 px-3 py-2 border-b hairline last:border-0 hover:bg-muted/30 cursor-pointer"
                      >
                        <Checkbox
                          checked={sel}
                          onCheckedChange={() =>
                            toggle({
                              entity_type: "unit",
                              entity_id: u.id,
                              label: `${u.building_name} · ${u.unit_number}`,
                              building_name: u.building_name,
                            })
                          }
                        />
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-sm text-architect">{u.unit_number}</span>
                          <span className="text-[11px] text-muted-foreground mono">{u.ref_code}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selected.length > 0 && (
        <div className="border hairline rounded-sm bg-warm-stone/20 p-3 space-y-2">
          <div className="label-eyebrow">Selected ({selected.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {selected.map((s) => (
              <span
                key={`${s.entity_type}:${s.entity_id}`}
                className="inline-flex items-center gap-1.5 bg-card border hairline px-2 py-1 rounded-sm text-xs"
              >
                {s.entity_type === "building" ? (
                  <Building2 className="h-3 w-3 text-true-taupe" strokeWidth={1.5} />
                ) : (
                  <Home className="h-3 w-3 text-true-taupe" strokeWidth={1.5} />
                )}
                <span className="text-architect">{s.label}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remove(s.entity_type, s.entity_id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}