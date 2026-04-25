import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, FileText, Sparkles, Users, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { OverdueRentAlert } from "@/components/owner/OverdueRentAlert";

export default function OwnerHome() {
  const { activeWorkspace } = useWorkspace();
  const [stats, setStats] = useState({ buildings: 0, units: 0, openRequests: 0, documents: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      const wid = activeWorkspace.id;
      const [b, u, sr, docs] = await Promise.all([
        supabase.from("buildings").select("id", { count: "exact", head: true }).eq("workspace_id", wid),
        supabase.from("units").select("id", { count: "exact", head: true }).eq("workspace_id", wid),
        supabase
          .from("service_requests")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", wid)
          .not("status", "in", "(closed,cancelled,completed)"),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("workspace_id", wid),
      ]);
      setStats({
        buildings: b.count ?? 0,
        units: u.count ?? 0,
        openRequests: sr.count ?? 0,
        documents: docs.count ?? 0,
      });
      setLoading(false);
    })();
  }, [activeWorkspace?.id]);

  const isEmpty = !loading && stats.buildings === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Welcome"
        title={`Hi${activeWorkspace ? `, ${activeWorkspace.name}` : ""}`}
        description="Manage your properties and request services in a few clicks."
      />

      {isEmpty ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" strokeWidth={1.5} />}
          title="Add your first property"
          description="Tell us about a property you own — just a name and address — and you’re set."
          action={
            <Link to="/owner/properties">
              <Button>Add property</Button>
            </Link>
          }
        />
      ) : (
        <>
          <OverdueRentAlert servicesHref="/owner/services" />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Properties" value={stats.buildings} />
            <StatCard label="Units" value={stats.units} />
            <StatCard label="Open requests" value={stats.openRequests} />
            <StatCard label="Documents" value={stats.documents} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <ActionCard
              icon={<Sparkles className="h-5 w-5" strokeWidth={1.5} />}
              title="Request a service"
              description="Cleaning, maintenance, photography, listing, valuation — pick what you need."
              to="/owner/services"
            />
            <ActionCard
              icon={<Users className="h-5 w-5" strokeWidth={1.5} />}
              title="Tenants & leases"
              description="See who's renting, when leases end, and trigger a renewal in a click."
              to="/owner/leases"
            />
            <ActionCard
              icon={<Building2 className="h-5 w-5" strokeWidth={1.5} />}
              title="My properties"
              description="Manage all your buildings and units."
              to="/owner/properties"
            />
            <ActionCard
              icon={<FileText className="h-5 w-5" strokeWidth={1.5} />}
              title="Documents"
              description="Title deeds, contracts, statements — all in one place."
              to="/owner/documents"
            />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <div className="label-eyebrow text-muted-foreground">{label}</div>
      <div className="font-display text-3xl text-architect mt-1">{value}</div>
    </Card>
  );
}

function ActionCard({
  icon,
  title,
  description,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Link to={to}>
      <Card className="p-5 h-full hover:border-architect/40 transition-colors group">
        <div className="flex items-start gap-3">
          <div className="text-architect/70">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-lg text-architect">{title}</div>
            <div className="text-sm text-muted-foreground mt-1">{description}</div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-architect transition-colors" />
        </div>
      </Card>
    </Link>
  );
}