import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, Map as MapIcon, LayoutGrid, List as ListIcon, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { BuildingFormDialog } from "@/components/properties/BuildingFormDialog";
import { PortfolioMap } from "@/components/properties/PortfolioMap";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BuildingRow {
  id: string;
  ref_code: string;
  name: string;
  city: string | null;
  country: string | null;
  address_line1: string | null;
  latitude: number | null;
  longitude: number | null;
  cover_image_url: string | null;
  total_floors: number | null;
  unit_count?: number;
}

type View = "grid" | "list" | "map";

export default function Properties() {
  const { canEdit } = useAuth();
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("grid");
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("buildings")
      .select("id, ref_code, name, city, country, address_line1, latitude, longitude, cover_image_url, total_floors, units(id)")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setBuildings(
      (data ?? []).map((b: any) => ({
        ...b,
        unit_count: b.units?.length ?? 0,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return buildings;
    return buildings.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.ref_code.toLowerCase().includes(q) ||
        (b.city ?? "").toLowerCase().includes(q),
    );
  }, [buildings, search]);

  return (
    <>
      <PageHeader
        eyebrow="Module · 01"
        title="Properties"
        description="Buildings and the units within them. Track status, photos, documents, and locations across the portfolio."
        actions={
          canEdit && (
            <Button variant="gold" onClick={() => setOpenCreate(true)}>
              <Plus className="h-4 w-4" />
              New building
            </Button>
          )
        }
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, code, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-9"
          />
        </div>

        <div className="inline-flex border hairline rounded-sm p-0.5 bg-muted/40">
          {[
            { v: "grid" as View, icon: LayoutGrid, label: "Grid" },
            { v: "list" as View, icon: ListIcon, label: "List" },
            { v: "map" as View, icon: MapIcon, label: "Map" },
          ].map((opt) => (
            <button
              key={opt.v}
              onClick={() => setView(opt.v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider rounded-sm transition-colors",
                view === opt.v ? "bg-architect text-chalk" : "text-muted-foreground hover:text-architect",
              )}
            >
              <opt.icon className="h-3.5 w-3.5" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 bg-muted/40 rounded-sm animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10" strokeWidth={1.2} />}
          title={search ? "No matches" : "No buildings yet"}
          description={search ? "Try a different search term." : "Add your first building to start mapping units, status, and people."}
          action={
            !search && canEdit && (
              <Button variant="gold" onClick={() => setOpenCreate(true)}>
                <Plus className="h-4 w-4" />
                Add a building
              </Button>
            )
          }
        />
      ) : view === "map" ? (
        <PortfolioMap
          markers={filtered
            .filter((b) => b.latitude && b.longitude)
            .map((b) => ({
              id: b.id,
              lat: Number(b.latitude),
              lng: Number(b.longitude),
              name: b.name,
              ref_code: b.ref_code,
            }))}
        />
      ) : view === "grid" ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <BuildingCard key={b.id} b={b} />
          ))}
        </div>
      ) : (
        <BuildingTable rows={filtered} />
      )}

      <BuildingFormDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        onSaved={() => {
          setOpenCreate(false);
          load();
        }}
      />
    </>
  );
}

function BuildingCard({ b }: { b: BuildingRow }) {
  return (
    <Link
      to={`/properties/${b.id}`}
      className="editorial-card overflow-hidden flex flex-col group"
    >
      <div className="aspect-[16/10] bg-muted/60 overflow-hidden relative">
        {b.cover_image_url ? (
          <img
            src={b.cover_image_url}
            alt={b.name}
            className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-true-taupe">
            <Building2 className="h-10 w-10" strokeWidth={1.2} />
          </div>
        )}
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="ref-code mb-1.5">{b.ref_code}</div>
        <h3 className="font-display text-xl text-architect leading-tight">{b.name}</h3>
        <div className="text-xs text-muted-foreground mt-1.5">
          {[b.address_line1, b.city, b.country].filter(Boolean).join(" · ") || "No address"}
        </div>
        <div className="mt-auto pt-4 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>{b.unit_count ?? 0} units</span>
          <span>{b.total_floors ? `${b.total_floors} floors` : ""}</span>
        </div>
      </div>
    </Link>
  );
}

function BuildingTable({ rows }: { rows: BuildingRow[] }) {
  return (
    <div className="border hairline rounded-sm overflow-hidden bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 border-b hairline">
          <tr className="text-left">
            <th className="px-4 py-3 label-eyebrow">Code</th>
            <th className="px-4 py-3 label-eyebrow">Building</th>
            <th className="px-4 py-3 label-eyebrow">Location</th>
            <th className="px-4 py-3 label-eyebrow text-right">Units</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-b hairline last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 ref-code">{b.ref_code}</td>
              <td className="px-4 py-3">
                <Link to={`/properties/${b.id}`} className="font-display text-base text-architect hover:text-gold">
                  {b.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {[b.city, b.country].filter(Boolean).join(", ") || "—"}
              </td>
              <td className="px-4 py-3 text-right mono text-xs">{b.unit_count ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
