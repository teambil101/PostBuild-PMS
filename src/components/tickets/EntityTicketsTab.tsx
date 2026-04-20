import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Ticket as TicketIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { TicketStatusPill, TicketPriorityPill } from "@/components/tickets/TicketPills";
import { NewTicketDialog, type PresetTarget } from "@/components/tickets/NewTicketDialog";
import {
  TICKET_PRIORITY_RANK,
  TICKET_TYPE_LABELS,
  TICKET_TYPE_CATEGORY,
  ACTIVE_TICKET_STATUSES,
  type TicketStatus,
  type TicketPriority,
  type TicketTargetType,
} from "@/lib/tickets";
import { format } from "date-fns";

export interface EntityTicketRow {
  id: string;
  ticket_number: string;
  subject: string;
  ticket_type: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee_id: string | null;
  due_date: string | null;
  created_at: string;
  target_entity_type: string;
  target_entity_id: string;
  is_system_generated: boolean;
}

export type StatusFilter = "active" | "all" | "closed" | "cancelled";

interface PersonMini {
  id: string;
  first_name: string;
  last_name: string;
}

/**
 * Section spec for grouped views. Each section runs an async query that
 * returns ticket rows; we sort/filter client-side.
 */
export interface TicketSection {
  key: string;
  label: string;
  emptyText?: string;
  fetch: () => Promise<EntityTicketRow[]>;
  /** Optional per-row sub-badge text (e.g. "Cheque #3"). */
  rowBadge?: (row: EntityTicketRow) => string | null;
}

interface BaseProps {
  entityType: TicketTargetType;
  entityId: string;
  entityLabel: string;
  presetTargetType?: TicketTargetType;
  presetTargetId?: string;
  presetTargetLabel?: string;
  /** Called whenever active ticket count is computed; parent uses this for the tab badge. */
  onActiveCountChange?: (n: number) => void;
}

interface FlatProps extends BaseProps {
  groupedView?: false;
}

interface GroupedProps extends BaseProps {
  groupedView: true;
  sections: TicketSection[];
}

type Props = FlatProps | GroupedProps;

export function EntityTicketsTab(props: Props) {
  const { entityType, entityId, entityLabel, onActiveCountChange } = props;
  const navigate = useNavigate();
  const { canEdit } = useAuth();

  const [filter, setFilter] = useState<StatusFilter>("active");
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<Record<string, PersonMini>>({});
  const [newOpen, setNewOpen] = useState(false);

  // Either a single rowset (flat) or per-section rowsets (grouped).
  const [flatRows, setFlatRows] = useState<EntityTicketRow[]>([]);
  const [sectionRows, setSectionRows] = useState<Record<string, EntityTicketRow[]>>({});

  const presetTarget: PresetTarget = {
    entity_type: (props.presetTargetType ?? entityType) as TicketTargetType,
    entity_id: props.presetTargetId ?? entityId,
    entity_label: props.presetTargetLabel ?? entityLabel,
  };

  const load = useCallback(async () => {
    setLoading(true);
    if (props.groupedView) {
      const entries = await Promise.all(
        props.sections.map(async (s) => [s.key, await s.fetch()] as const),
      );
      setSectionRows(Object.fromEntries(entries));
    } else {
      const { data } = await supabase
        .from("tickets")
        .select(
          "id, ticket_number, subject, ticket_type, priority, status, assignee_id, due_date, created_at, target_entity_type, target_entity_id, is_system_generated",
        )
        .eq("target_entity_type", entityType)
        .eq("target_entity_id", entityId)
        .order("created_at", { ascending: false });
      setFlatRows((data ?? []) as EntityTicketRow[]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entityType,
    entityId,
    props.groupedView,
    // sections is identity-stable enough for our use; recompute when entity changes
  ]);

  useEffect(() => {
    load();
  }, [load]);

  // Load people for assignee labels
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("people")
        .select("id, first_name, last_name");
      if (cancelled) return;
      const map: Record<string, PersonMini> = {};
      for (const p of (data ?? []) as PersonMini[]) map[p.id] = p;
      setPeople(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute "active" count across everything (regardless of current filter).
  const allRowsForCount = useMemo<EntityTicketRow[]>(() => {
    if (props.groupedView) {
      // Distinct by id across sections.
      const seen = new Set<string>();
      const out: EntityTicketRow[] = [];
      for (const s of props.sections) {
        for (const r of sectionRows[s.key] ?? []) {
          if (seen.has(r.id)) continue;
          seen.add(r.id);
          out.push(r);
        }
      }
      return out;
    }
    return flatRows;
  }, [props.groupedView, props.groupedView ? props.sections : null, sectionRows, flatRows]);

  const activeCount = useMemo(
    () =>
      allRowsForCount.filter((r) =>
        ACTIVE_TICKET_STATUSES.includes(r.status as TicketStatus),
      ).length,
    [allRowsForCount],
  );

  useEffect(() => {
    onActiveCountChange?.(activeCount);
  }, [activeCount, onActiveCountChange]);

  const applyFilter = (rows: EntityTicketRow[]): EntityTicketRow[] => {
    let filtered = rows;
    if (filter === "active") {
      filtered = rows.filter((r) => ACTIVE_TICKET_STATUSES.includes(r.status));
    } else if (filter === "closed") {
      filtered = rows.filter((r) => r.status === "closed");
    } else if (filter === "cancelled") {
      filtered = rows.filter((r) => r.status === "cancelled");
    }
    // Sort: priority desc, then due_date asc, then created_at desc
    return [...filtered].sort((a, b) => {
      const p = TICKET_PRIORITY_RANK[a.priority] - TICKET_PRIORITY_RANK[b.priority];
      if (p !== 0) return p;
      const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      if (da !== db) return da - db;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const handleCreated = () => {
    load();
  };

  const filterPills: { key: StatusFilter; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "all", label: "All" },
    { key: "closed", label: "Closed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {filterPills.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-2.5 py-1 rounded-sm border text-[10px] uppercase tracking-wider",
                filter === f.key
                  ? "bg-architect text-chalk border-architect"
                  : "bg-card text-muted-foreground border-warm-stone hover:bg-muted/40",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {canEdit && (
          <Button variant="gold" size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New ticket
          </Button>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="h-40 bg-muted/40 animate-pulse rounded-sm" />
      ) : props.groupedView ? (
        <div className="space-y-8">
          {props.sections.map((s) => {
            const rows = applyFilter(sectionRows[s.key] ?? []);
            return (
              <SectionBlock
                key={s.key}
                title={s.label}
                count={(sectionRows[s.key] ?? []).filter((r) =>
                  ACTIVE_TICKET_STATUSES.includes(r.status),
                ).length}
                emptyText={s.emptyText ?? "No tickets in this section."}
                rows={rows}
                people={people}
                onClickRow={(t) => navigate(`/tickets/${t.id}`)}
                rowBadge={s.rowBadge}
              />
            );
          })}
        </div>
      ) : (
        (() => {
          const rows = applyFilter(flatRows);
          if (flatRows.length === 0) {
            return (
              <EmptyState
                icon={<TicketIcon className="h-8 w-8" strokeWidth={1.2} />}
                title={`No tickets ${entityType}-related.`}
                description="Track issues, tasks, or follow-ups linked to this record."
                action={
                  canEdit && (
                    <Button variant="gold" size="sm" onClick={() => setNewOpen(true)}>
                      <Plus className="h-3.5 w-3.5" />
                      Create the first
                    </Button>
                  )
                }
              />
            );
          }
          if (rows.length === 0) {
            return (
              <div className="border hairline rounded-sm bg-card px-4 py-10 text-center text-sm text-muted-foreground italic">
                No tickets match this filter.
              </div>
            );
          }
          return (
            <TicketTable
              rows={rows}
              people={people}
              onClickRow={(t) => navigate(`/tickets/${t.id}`)}
            />
          );
        })()
      )}

      <NewTicketDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        presetTarget={presetTarget}
        onCreated={handleCreated}
        navigateOnCreate={false}
      />
    </div>
  );
}

/* =========================================================
 * Subcomponents
 * ========================================================= */

function SectionBlock({
  title,
  count,
  emptyText,
  rows,
  people,
  onClickRow,
  rowBadge,
}: {
  title: string;
  count: number;
  emptyText: string;
  rows: EntityTicketRow[];
  people: Record<string, PersonMini>;
  onClickRow: (t: EntityTicketRow) => void;
  rowBadge?: (row: EntityTicketRow) => string | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2 label-eyebrow">
        <span>{title}</span>
        <span className="text-true-taupe">({count})</span>
      </div>
      {rows.length === 0 ? (
        <div className="border hairline rounded-sm bg-card px-4 py-6 text-xs text-muted-foreground italic text-center">
          {emptyText}
        </div>
      ) : (
        <TicketTable rows={rows} people={people} onClickRow={onClickRow} rowBadge={rowBadge} />
      )}
    </div>
  );
}

function TicketTable({
  rows,
  people,
  onClickRow,
  rowBadge,
}: {
  rows: EntityTicketRow[];
  people: Record<string, PersonMini>;
  onClickRow: (t: EntityTicketRow) => void;
  rowBadge?: (row: EntityTicketRow) => string | null;
}) {
  return (
    <div className="border hairline rounded-sm overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 border-b hairline text-left">
            <tr>
              <th className="px-3 py-2 label-eyebrow">TKT #</th>
              <th className="px-3 py-2 label-eyebrow">Subject</th>
              <th className="px-3 py-2 label-eyebrow">Type</th>
              <th className="px-3 py-2 label-eyebrow">Priority</th>
              <th className="px-3 py-2 label-eyebrow">Status</th>
              <th className="px-3 py-2 label-eyebrow">Assignee</th>
              <th className="px-3 py-2 label-eyebrow">Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const subject =
                t.subject.length > 50 ? t.subject.slice(0, 50) + "…" : t.subject;
              const assignee = t.assignee_id ? people[t.assignee_id] : null;
              const badge = rowBadge?.(t);
              return (
                <tr
                  key={t.id}
                  className="border-b hairline last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => onClickRow(t)}
                >
                  <td className="px-3 py-2 mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {t.ticket_number}
                  </td>
                  <td className="px-3 py-2 max-w-[280px]">
                    <div className="text-architect truncate" title={t.subject}>
                      {subject}
                    </div>
                    {badge && (
                      <div className="text-[10px] uppercase tracking-wider text-true-taupe mt-0.5">
                        {badge}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground whitespace-nowrap">
                    <div className="text-[10px] uppercase tracking-wider text-true-taupe">
                      {TICKET_TYPE_CATEGORY(t.ticket_type)}
                    </div>
                    <div>
                      {TICKET_TYPE_LABELS[t.ticket_type as keyof typeof TICKET_TYPE_LABELS] ??
                        t.ticket_type}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <TicketPriorityPill priority={t.priority} />
                  </td>
                  <td className="px-3 py-2">
                    <TicketStatusPill status={t.status} />
                  </td>
                  <td className="px-3 py-2 text-[11px]">
                    {assignee ? (
                      <span className="text-architect">
                        {assignee.first_name} {assignee.last_name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground whitespace-nowrap">
                    {t.due_date ? format(new Date(t.due_date), "MMM d, yyyy") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}