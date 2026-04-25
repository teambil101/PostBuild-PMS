import { useEffect, useState } from "react";
import { Users, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { OverdueRentAlert } from "@/components/owner/OverdueRentAlert";

interface LeaseRow {
  id: string;
  title: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

export default function OwnerLeases() {
  const { activeWorkspace } = useWorkspace();
  const [leases, setLeases] = useState<LeaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      const { data } = await supabase
        .from("contracts")
        .select("id, title, status, start_date, end_date, contract_type")
        .eq("workspace_id", activeWorkspace.id)
        .eq("contract_type", "lease")
        .order("end_date", { ascending: true });
      setLeases(((data ?? []) as unknown) as LeaseRow[]);
      setLoading(false);
    })();
  }, [activeWorkspace?.id]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Tenants & Leases"
        description="Track who's renting your properties and when each lease ends."
        actions={
          <Button variant="outline" disabled>
            <Plus className="h-4 w-4 mr-2" /> Add lease (coming soon)
          </Button>
        }
      />

      <OverdueRentAlert servicesHref="/owner/services" />

      {loading ? null : leases.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" strokeWidth={1.5} />}
          title="No leases yet"
          description="Once a tenant moves in, leases will appear here. You can also request our team to draft a new lease."
        />
      ) : (
        <div className="space-y-3">
          {leases.map((l) => (
            <Card key={l.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-display text-base text-architect">{l.title ?? "Untitled lease"}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {l.start_date ?? "—"} → {l.end_date ?? "—"}
                </div>
              </div>
              <span className="mono text-[10px] uppercase text-gold">{l.status}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}