import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Filter, Plus, Search, Wrench, Workflow, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { RequestStatusBadge } from "@/components/services/RequestStatusBadge";
import {
  PRIORITY_LABEL,
  PRIORITY_STYLES,
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_STYLES,
  type ServiceRequestPriority,
  type ServiceRequestStatus,
  type ServiceRequestApprovalStatus,
} from "@/lib/services";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface RequestRow {
  id: string;
  request_number: string;
  title: string;
  status: ServiceRequestStatus;
  priority: ServiceRequestPriority;
  is_workflow: boolean;
  target_type: string;
  target_id: string | null;
  scheduled_date: string | null;
  created_at: string;
  target_label: string;
  approval_status: ServiceRequestApprovalStatus;
}

type StatusFilter = "all" | "approval" | "open" | "active" | "completed" | "cancelled";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "approval", label: "Awaiting approval" },
  { key: "open", label: "Open" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export default function ServiceRequests() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("service_requests")
      .select("id,request_number,title,status,priority,is_workflow,target_type,target_id,scheduled_date,created_at,approval_status")
      .order("created_at", { ascending: false });
    if (error || !data) {
      setLoading(false);
      return;
    }

    // Resolve target labels in batch
    const unitIds = data.filter((r) => r.target_type === "unit" && r.target_id).map((r) => r.target_id!) as string[];
    const buildingIds = data.filter((r) => r.target_type === "building" && r.target_id).map((r) => r.target_id!) as string[];

    const [unitsRes, buildingsRes] = await Promise.all([
      unitIds.length
        ? supabase.from("units").select("id,unit_number,buildings(name)").in("id", unitIds)
        : Promise.resolve({ data: [] as any[] }),
      buildingIds.length
        ? supabase.from("buildings").select("id,name").in("id", buildingIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const unitMap = new Map<string, string>();
    (unitsRes.data ?? []).forEach((u: any) =>
      unitMap.set(u.id, `${u.buildings?.name ?? "—"} · ${u.unit_number}`),
    );
    const bldMap = new Map<string, string>();
    (buildingsRes.data ?? []).forEach((b: any) => bldMap.set(b.id, b.name));

    setRequests(
      data.map((r) => ({
        ...r,
        target_label:
          r.target_type === "unit"
            ? unitMap.get(r.target_id!) ?? "Unit"
            : r.target_type === "building"
              ? bldMap.get(r.target_id!) ?? "Building"
              : "Portfolio",
      })) as RequestRow[],
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (filter === "approval" && r.approval_status !== "pending") return false;
      if (filter === "open" && r.status !== "open") return false;
      if (filter === "active" && !["scheduled", "in_progress", "blocked"].includes(r.status)) return false;
      if (filter === "completed" && r.status !== "completed") return false;
      if (filter === "cancelled" && r.status !== "cancelled") return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.request_number.toLowerCase().includes(q) ||
        r.target_label.toLowerCase().includes(q)
      );
    });
  }, [requests, filter, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-sm border hairline transition-colors",
                filter === f.key
                  ? "bg-architect text-chalk border-architect"
                  : "text-muted-foreground hover:text-architect hover:bg-muted/40",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search requests…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">Loading requests…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-10 w-10" strokeWidth={1.2} />}
          title={requests.length === 0 ? "No requests yet" : "Nothing matches"}
          description={
            requests.length === 0
              ? "Create your first work order from the catalog."
              : "Try a different filter or search."
          }
          action={
            requests.length === 0 ? (
              <Button asChild>
                <Link to="/services/requests/new">
                  <Plus className="h-4 w-4" />
                  New request
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="border hairline rounded-sm bg-card divide-y hairline overflow-hidden">
          {filtered.map((r) => (
            <Link
              key={r.id}
              to={`/services/requests/${r.id}`}
              className="px-4 py-3 flex items-center gap-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="mono text-[10px] text-muted-foreground">{r.request_number}</span>
                  <span className="text-sm text-architect font-medium">{r.title}</span>
                  {r.is_workflow && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-architect border border-architect/40 px-1.5 py-0.5 rounded-sm">
                      <Workflow className="h-3 w-3" />
                      Workflow
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap text-[11px] text-muted-foreground">
                  <span>{r.target_label}</span>
                  {r.scheduled_date && <span>· Scheduled {format(new Date(r.scheduled_date), "d MMM yyyy")}</span>}
                  <span className={cn("uppercase tracking-wider", PRIORITY_STYLES[r.priority])}>
                    · {PRIORITY_LABEL[r.priority]}
                  </span>
                  {r.approval_status !== "not_required" && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 uppercase tracking-wider px-1.5 py-0.5 rounded-sm border",
                        APPROVAL_STATUS_STYLES[r.approval_status],
                      )}
                    >
                      <ShieldAlert className="h-3 w-3" />
                      {APPROVAL_STATUS_LABEL[r.approval_status]}
                    </span>
                  )}
                </div>
              </div>
              <RequestStatusBadge status={r.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}