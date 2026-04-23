import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Home, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { BuildingFormDialog } from "@/components/properties/BuildingFormDialog";
import { GlobalUnitFormDialog } from "@/components/properties/GlobalUnitFormDialog";
import { COUNTRY_BY_CODE } from "@/lib/countries";
import { formatEnumLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BuildingRow {
  id: string;
  ref_code: string;
  name: string;
  city: string;
  country: string;
  location_url: string | null;
  community: string | null;
  building_type: string;
  unit_count?: number;
}

interface UnitRow {
  id: string;
  ref_code: string;
  unit_number: string;
  unit_type: string;
  status: string;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  asking_rent: number | null;
  asking_rent_currency: string | null;
  building_id: string;
  building_name: string;
}

export default function Properties() {
  const { canEdit } = useAuth();
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"units" | "buildings">("units");
  const [openNewBuilding, setOpenNewBuilding] = useState(false);
  const [openNewUnit, setOpenNewUnit] = useState(false);
  const [filterBuilding, setFilterBuilding] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const [{ data: bs, error: bErr }, { data: us, error: uErr }] = await Promise.all([
      supabase
        .from("buildings")
        .select("id, ref_code, name, city, country, location_url, community, building_type, units(id)")
        .order("created_at", { ascending: false }),
      supabase
        .from("units")
        .select(
          "id, ref_code, unit_number, unit_type, status, bedrooms, bathrooms, size_sqm, asking_rent, asking_rent_currency, building_id, building:buildings(name)",
        )
        .order("ref_code"),
    ]);
    if (bErr || uErr) {
      toast.error(bErr?.message || uErr?.message || "Failed to load");
      setLoading(false);
      return;
    }
    setBuildings(
      (bs ?? []).map((b: any) => ({
        ...b,
        unit_count: b.units?.length ?? 0,
      })),
    );
    setUnits(
      (us ?? []).map((u: any) => ({
        id: u.id,
        ref_code: u.ref_code,
        unit_number: u.unit_number,
        unit_type: u.unit_type,
        status: u.status,
        bedrooms: u.bedrooms,
        bathrooms: u.bathrooms,
        size_sqm: u.size_sqm,
        asking_rent: u.asking_rent,
        asking_rent_currency: u.asking_rent_currency,
        building_id: u.building_id,
        building_name: u.building?.name ?? "—",
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredBuildings = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return buildings;
    return buildings.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.ref_code.toLowerCase().includes(q) ||
        (b.city ?? "").toLowerCase().includes(q) ||
        (b.community ?? "").toLowerCase().includes(q),
    );
  }, [buildings, search]);

  const filteredUnits = useMemo(() => {
    const q = search.toLowerCase().trim();
    return units.filter((u) => {
      if (filterBuilding !== "all" && u.building_id !== filterBuilding) return false;
      if (filterStatus !== "all" && u.status !== filterStatus) return false;
      if (!q) return true;
      return (
        u.unit_number.toLowerCase().includes(q) ||
        u.ref_code.toLowerCase().includes(q) ||
        u.building_name.toLowerCase().includes(q) ||
        (u.unit_type ?? "").toLowerCase().includes(q)
      );
    });
  }, [units, search, filterBuilding, filterStatus]);

  return (
    <>
      <PageHeader
        eyebrow="Module · 01"
        title="Properties"
        description="Units are where work happens. Buildings group units (city, type, owners). Track status, photos, documents, and locations across the portfolio."
        actions={
          canEdit && (
            <div className="flex items-center gap-2">
              {tab === "units" ? (
                <Button variant="gold" onClick={() => setOpenNewUnit(true)}>
                  <Plus className="h-4 w-4" />
                  New unit
                </Button>
              ) : (
                <Button variant="gold" onClick={() => setOpenNewBuilding(true)}>
                  <Plus className="h-4 w-4" />
                  New building
                </Button>
              )}
            </div>
          )
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "units" | "buildings")}>
        <TabsList>
          <TabsTrigger value="units">Units ({units.length})</TabsTrigger>
          <TabsTrigger value="buildings">Buildings ({buildings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="units" className="mt-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by unit, building, ref code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-9"
              />
            </div>
            <Select value={filterBuilding} onValueChange={setFilterBuilding}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All buildings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All buildings</SelectItem>
                {buildings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="vacant">Vacant</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="under_maintenance">Under maintenance</SelectItem>
                <SelectItem value="off_market">Off market</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted/40 rounded-sm animate-pulse" />
              ))}
            </div>
          ) : filteredUnits.length === 0 ? (
            <EmptyState
              icon={<Home className="h-10 w-10" strokeWidth={1.2} />}
              title={search || filterBuilding !== "all" || filterStatus !== "all" ? "No matches" : "No units yet"}
              description={
                search || filterBuilding !== "all" || filterStatus !== "all"
                  ? "Try a different search or clear filters."
                  : "Add your first unit to start tracking work, contracts, and tenants."
              }
              action={
                !search && filterBuilding === "all" && filterStatus === "all" && canEdit && (
                  <Button variant="gold" onClick={() => setOpenNewUnit(true)}>
                    <Plus className="h-4 w-4" />
                    Add a unit
                  </Button>
                )
              }
            />
          ) : (
            <UnitTable rows={filteredUnits} />
          )}
        </TabsContent>

        <TabsContent value="buildings" className="mt-5 space-y-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, city, community…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
            />
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-56 bg-muted/40 rounded-sm animate-pulse" />
              ))}
            </div>
          ) : filteredBuildings.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-10 w-10" strokeWidth={1.2} />}
              title={search ? "No matches" : "No buildings yet"}
              description={search ? "Try a different search term." : "Add your first building to start mapping units, status, and people."}
              action={
                !search && canEdit && (
                  <Button variant="gold" onClick={() => setOpenNewBuilding(true)}>
                    <Plus className="h-4 w-4" />
                    Add a building
                  </Button>
                )
              }
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBuildings.map((b) => (
                <BuildingCard key={b.id} b={b} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <BuildingFormDialog
        open={openNewBuilding}
        onOpenChange={setOpenNewBuilding}
        onSaved={() => {
          setOpenNewBuilding(false);
          load();
        }}
      />

      <GlobalUnitFormDialog
        open={openNewUnit}
        onOpenChange={setOpenNewUnit}
        onCreated={() => {
          setOpenNewUnit(false);
          load();
        }}
      />
    </>
  );
}

function BuildingCard({ b }: { b: BuildingRow }) {
  const location = [b.community, b.city, COUNTRY_BY_CODE[b.country] ?? b.country]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      to={`/properties/${b.id}`}
      className="editorial-card overflow-hidden flex flex-col group"
    >
      <div className="aspect-[16/10] bg-muted/60 overflow-hidden relative flex items-center justify-center text-true-taupe">
        <Building2 className="h-10 w-10" strokeWidth={1.2} />
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="ref-code mb-1.5">{b.ref_code}</div>
        <h3 className="font-display text-xl text-architect leading-tight">{b.name}</h3>
        <div className="text-xs text-muted-foreground mt-1.5">
          {location || "No location"}
        </div>
        <div className="mt-auto pt-4 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>{b.unit_count ?? 0} units</span>
          <span>{formatEnumLabel(b.building_type)}</span>
        </div>
      </div>
    </Link>
  );
}

function UnitTable({ rows }: { rows: UnitRow[] }) {
  return (
    <div className="border hairline rounded-sm overflow-hidden bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 border-b hairline">
          <tr className="text-left">
            <th className="px-4 py-3 label-eyebrow">Code</th>
            <th className="px-4 py-3 label-eyebrow">Unit</th>
            <th className="px-4 py-3 label-eyebrow">Type</th>
            <th className="px-4 py-3 label-eyebrow">Status</th>
            <th className="px-4 py-3 label-eyebrow">Beds / Baths</th>
            <th className="px-4 py-3 label-eyebrow">Size</th>
            <th className="px-4 py-3 label-eyebrow text-right">Asking rent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-b hairline last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 ref-code">{u.ref_code}</td>
              <td className="px-4 py-3">
                <Link
                  to={`/properties/${u.building_id}/units/${u.id}`}
                  className="text-architect hover:text-gold"
                >
                  <span className="font-display text-base">{u.building_name}</span>{" "}
                  <span className="text-muted-foreground">·</span>{" "}
                  <span>Unit {u.unit_number}</span>
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground capitalize">{formatEnumLabel(u.unit_type)}</td>
              <td className="px-4 py-3">
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border hairline text-muted-foreground">
                  {u.status.replace(/_/g, " ")}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground mono text-xs">
                {u.bedrooms ?? "—"} / {u.bathrooms ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground mono text-xs">
                {u.size_sqm ? `${u.size_sqm} sqm` : "—"}
              </td>
              <td className="px-4 py-3 text-right mono text-xs">
                {u.asking_rent ? `${u.asking_rent_currency ?? ""} ${u.asking_rent.toLocaleString()}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}