import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { formatEnumLabel } from "@/lib/format";

interface IncomingRequest {
  id: string;
  request_number: string;
  title: string;
  status: string;
  category: string;
  description: string | null;
  created_at: string;
  workspace_id: string;
  source: string;
}

interface WorkspaceLite {
  id: string;
  name: string;
  kind: string;
}

export default function MarketplaceInbox() {
  const { activeWorkspace } = useWorkspace();
  const [items, setItems] = useState<IncomingRequest[]>([]);
  const [workspaces, setWorkspaces] = useState<Record<string, WorkspaceLite>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      const { data: reqs } = await supabase
        .from("service_requests")
        .select("id, request_number, title, status, category, description, created_at, workspace_id, source")
        .eq("fulfilling_workspace_id", activeWorkspace.id)
        .neq("workspace_id", activeWorkspace.id)
        .order("created_at", { ascending: false })
        .limit(100);

      const rows = ((reqs ?? []) as unknown) as IncomingRequest[];
      setItems(rows);

      const ids = Array.from(new Set(rows.map((r) => r.workspace_id)));
      if (ids.length) {
        const { data: ws } = await supabase
          .from("workspaces")
          .select("id, name, kind")
          .in("id", ids);
        const byId: Record<string, WorkspaceLite> = {};
        ((ws ?? []) as unknown as WorkspaceLite[]).forEach((w) => (byId[w.id] = w));
        setWorkspaces(byId);
      }
      setLoading(false);
    })();
  }, [activeWorkspace?.id]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Inbox"
        description="Service requests submitted to you from owner and broker workspaces. Open a request to accept, quote, or assign."
      />

      {loading ? null : items.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-8 w-8" strokeWidth={1.5} />}
          title="No external requests yet"
          description="When an owner or broker requests a service from your marketplace, it'll show up here."
        />
      ) : (
        <div className="space-y-2">
          {items.map((r) => {
            const ws = workspaces[r.workspace_id];
            return (
              <Link key={r.id} to={`/services/requests/${r.id}`}>
                <Card className="p-4 flex items-center gap-4 hover:border-architect/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="mono text-[10px] uppercase text-muted-foreground">{r.request_number}</span>
                      <span className="mono text-[10px] uppercase text-gold">{r.status}</span>
                    </div>
                    <div className="font-display text-base text-architect mt-1 truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {formatEnumLabel(r.category)}
                      {r.description ? ` · ${r.description}` : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-architect flex items-center justify-end gap-1">
                      <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                      {ws?.name ?? "External"}
                    </div>
                    <div className="mono text-[10px] uppercase text-muted-foreground mt-0.5">
                      {ws?.kind ?? "—"} · {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}