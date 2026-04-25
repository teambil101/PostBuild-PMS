import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { formatEnumLabel } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";

interface RequestRow {
  id: string;
  request_number: string;
  title: string;
  status: string;
  priority: string | null;
  category: string;
  created_at: string;
  scheduled_date: string | null;
  cost_estimate: number | null;
  currency: string | null;
}

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200",
  in_progress: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export default function ServiceRequests() {
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [items, setItems] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace?.id) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("service_requests")
      .select(
        "id, request_number, title, status, priority, category, created_at, scheduled_date, cost_estimate, currency",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    setItems(((data ?? []) as unknown) as RequestRow[]);
    setLoading(false);
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Wrench className="h-8 w-8" />}
        title="No service requests yet"
        description="Create a request to get vendors quoting and the work scheduled."
        action={
          <Button asChild>
            <Link to="/services/requests/new">
              <Plus className="h-4 w-4 mr-2" /> New request
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} request{items.length === 1 ? "" : "s"}
        </p>
        <Button asChild size="sm">
          <Link to="/services/requests/new">
            <Plus className="h-4 w-4 mr-2" /> New request
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Request</th>
                <th className="text-left px-4 py-3 font-medium">Category</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Scheduled</th>
                <th className="text-right px-4 py-3 font-medium">Estimate</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-muted/30 cursor-pointer"
                  onClick={() => navigate(`/services/requests/${r.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground">{r.request_number}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatEnumLabel(r.category)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_TONE[r.status] ?? ""}>
                      {formatEnumLabel(r.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.scheduled_date ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {r.cost_estimate
                      ? `${r.currency ?? ""} ${Number(r.cost_estimate).toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}