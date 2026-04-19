import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Users, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";

interface Stats {
  buildings: number;
  units: number;
  people: number;
  vacant: number;
  occupied: number;
}

export default function Dashboard() {
  const { user, roles } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const [b, u, p, vac, occ] = await Promise.all([
        supabase.from("buildings").select("id", { count: "exact", head: true }),
        supabase.from("units").select("id", { count: "exact", head: true }),
        supabase.from("people").select("id", { count: "exact", head: true }),
        supabase.from("units").select("id", { count: "exact", head: true }).eq("status", "vacant"),
        supabase.from("units").select("id", { count: "exact", head: true }).eq("status", "occupied"),
      ]);
      setStats({
        buildings: b.count ?? 0,
        units: u.count ?? 0,
        people: p.count ?? 0,
        vacant: vac.count ?? 0,
        occupied: occ.count ?? 0,
      });
    })();
  }, []);

  const metrics = [
    { label: "Buildings", value: stats?.buildings, to: "/properties" },
    { label: "Units", value: stats?.units, to: "/properties" },
    { label: "People", value: stats?.people, to: "/people" },
    { label: "Occupancy", value: stats ? `${stats.units ? Math.round((stats.occupied / stats.units) * 100) : 0}%` : null, to: "/properties" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title={`Good day${user?.email ? ", " + user.email.split("@")[0] : ""}.`}
        description="Your property operations at a glance. Start with Properties or People — the rest of the platform unlocks as we build it together."
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-warm-stone/60 border hairline rounded-sm overflow-hidden mb-12">
        {metrics.map((m) => (
          <Link
            key={m.label}
            to={m.to}
            className="bg-card p-6 hover:bg-muted/40 transition-colors group"
          >
            <div className="label-eyebrow">{m.label}</div>
            <div className="font-display text-4xl text-architect mt-2">
              {m.value ?? "—"}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-gold mt-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              View <ArrowUpRight className="h-3 w-3" />
            </div>
          </Link>
        ))}
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <Link to="/properties" className="editorial-card p-8 group">
          <Building2 className="h-6 w-6 text-gold" strokeWidth={1.5} />
          <h3 className="font-display text-2xl text-architect mt-4">Properties</h3>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Buildings and units. Status, photos, documents, and a portfolio map.
          </p>
          <div className="mono text-[10px] uppercase tracking-widest text-gold mt-6 flex items-center gap-1.5">
            Open module <ArrowUpRight className="h-3 w-3" />
          </div>
        </Link>

        <Link to="/people" className="editorial-card p-8 group">
          <Users className="h-6 w-6 text-gold" strokeWidth={1.5} />
          <h3 className="font-display text-2xl text-architect mt-4">People</h3>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Tenants, owners, prospects, staff and vendors — linked to the properties they touch.
          </p>
          <div className="mono text-[10px] uppercase tracking-widest text-gold mt-6 flex items-center gap-1.5">
            Open module <ArrowUpRight className="h-3 w-3" />
          </div>
        </Link>
      </section>

      <section className="mt-12 border hairline rounded-sm p-6 bg-muted/30">
        <div className="label-eyebrow text-gold">Roadmap</div>
        <p className="text-sm text-muted-foreground mt-2">
          Contracts, lease lifecycle, tickets & workflows, dashboards, vendors and services modules
          are scaffolded and will activate as we build them out — one polished module at a time.
        </p>
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground/70 mt-3">
          Signed in as <span className="text-architect">{user?.email}</span> · Role <span className="text-architect">{roles[0] ?? "viewer"}</span>
        </div>
      </section>
    </>
  );
}
