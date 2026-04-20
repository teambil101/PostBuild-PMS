import { useEffect, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  PlusCircle, Activity, CheckCircle2, XCircle, PauseCircle, PlayCircle,
  User, Edit3, TrendingUp, Calendar, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/leads";
import { formatEnumLabel } from "@/lib/format";

interface EventRow {
  id: string;
  lead_id: string;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  description: string | null;
  actor_id: string | null;
  created_at: string;
}

const ICONS: Record<string, { Icon: typeof PlusCircle; tone: string }> = {
  created: { Icon: PlusCircle, tone: "text-muted-foreground" },
  status_changed: { Icon: Activity, tone: "text-architect" },
  marked_contract_signed: { Icon: CheckCircle2, tone: "text-status-occupied" },
  marked_lost: { Icon: XCircle, tone: "text-destructive" },
  put_on_hold: { Icon: PauseCircle, tone: "text-amber-700" },
  resumed_from_hold: { Icon: PlayCircle, tone: "text-architect" },
  assignee_changed: { Icon: User, tone: "text-architect" },
  contact_changed: { Icon: User, tone: "text-architect" },
  proposal_updated: { Icon: Edit3, tone: "text-architect" },
  estimate_updated: { Icon: TrendingUp, tone: "text-gold" },
  target_close_changed: { Icon: Calendar, tone: "text-architect" },
  updated: { Icon: Edit3, tone: "text-muted-foreground" },
};

function describe(e: EventRow): string {
  if (e.description) return e.description;
  const fmtStatus = (v: string | null) =>
    v && (LEAD_STATUS_LABELS[v as LeadStatus] ?? formatEnumLabel(v));
  switch (e.event_type) {
    case "created":
      return `Lead created at stage ${fmtStatus(e.to_value) ?? "New"}`;
    case "status_changed":
      return `Stage changed: ${fmtStatus(e.from_value) ?? "—"} → ${fmtStatus(e.to_value) ?? "—"}`;
    case "marked_contract_signed":
      return "Marked as Contract Signed";
    case "marked_lost":
      return `Marked as Lost${e.to_value ? ` — ${formatEnumLabel(e.to_value)}` : ""}`;
    case "put_on_hold":
      return "Put on hold";
    case "resumed_from_hold":
      return `Resumed from hold to ${fmtStatus(e.to_value) ?? "—"}`;
    case "assignee_changed":
      return "Assignee changed";
    case "contact_changed":
      return "Primary contact or company changed";
    case "proposal_updated":
      return "Proposed terms updated";
    case "estimate_updated":
      return "Estimate updated";
    case "target_close_changed":
      return `Target close ${e.to_value ? `set to ${e.to_value}` : "cleared"}`;
    case "updated":
      return "Lead updated";
    default:
      return formatEnumLabel(e.event_type);
  }
}

export function LeadHistoryTab({ leadId }: { leadId: string }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("lead_events")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(200);
      setEvents((data ?? []) as EventRow[]);
      setLoading(false);
    })();
  }, [leadId]);

  if (loading) {
    return <div className="h-32 bg-muted/40 animate-pulse rounded-sm" />;
  }
  if (events.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="h-8 w-8" strokeWidth={1.2} />}
        title="No history yet"
        description="Structural changes to this lead will appear here as they happen."
      />
    );
  }

  return (
    <div className="border hairline rounded-sm bg-card divide-y divide-warm-stone/60">
      {events.map((e) => {
        const ic = ICONS[e.event_type] ?? { Icon: Edit3, tone: "text-muted-foreground" };
        const Icon = ic.Icon;
        return (
          <div key={e.id} className="flex items-start gap-3 px-4 py-3">
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${ic.tone}`} strokeWidth={1.6} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-architect">{describe(e)}</div>
              <div
                className="text-[11px] text-muted-foreground mono mt-0.5"
                title={format(new Date(e.created_at), "PPpp")}
              >
                {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                {e.actor_id ? "" : " · System"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}