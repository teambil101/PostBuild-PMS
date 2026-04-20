import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, AlertTriangle, Clock, CircleAlert, User as UserIcon, Coins, Ticket as TicketIcon, ArrowUpDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { processSystemAutomations } from "@/lib/automations";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { TicketStatusPill, TicketPriorityPill } from "@/components/tickets/TicketPills";
import { NewTicketDialog } from "@/components/tickets/NewTicketDialog";
import {
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_RANK,
  TICKET_TYPE_LABELS,
  TICKET_TYPE_CATEGORY,
  WAITING_ON_LABELS,
  ACTIVE_TICKET_STATUSES,
  isTicketOverdue,
  resolveTicketTargetLabels,
  type TicketStatus,
  type TicketPriority,
  type WaitingOn,
} from "@/lib/tickets";
import { formatDistanceToNow, format } from "date-fns";

interface TicketRow {
  id: string;
  ticket_number: string;
  subject: string;
  ticket_type: string;
  priority: TicketPriority;
  status: TicketStatus;
  waiting_on: WaitingOn | null;
  target_entity_type: string;
  target_entity_id: string;
  assignee_id: string | null;
  due_date: string | null;
  created_at: string;
  cost_approval_status: string | null;
  is_system_generated: boolean;
  vendor_id: string | null;
}

type SortKey = "ticket_number" | "subject" | "priority" | "status" | "due" | "age";

export default function TicketsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<TicketRow[]>([]);
  const [targetLabels, setTargetLabels] = useState<Record<string, string>>({});
  const [people, setPeople] = useState<Record<string, { first_name: string; last_name: string }>>({});
  const [vendors, setVendors] = useState<Record<string, { legal_name: string; display_name: string | null; vendor_number: string }>>({});
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [selfPersonId, setSelfPersonId] = useState<string | null>(null);

  // Filter state ← URL
  const statusParam = searchParams.get("status");
  const statuses: Set<TicketStatus> = useMemo(() => {
    if (!statusParam) return new Set(ACTIVE_TICKET_STATUSES);
    return new Set(statusParam.split(",").filter(Boolean) as TicketStatus[]);
  }, [statusParam]);
  const priorityParam = searchParams.get("priority");
  const priorities: Set<TicketPriority> = useMemo(() => {
    if (!priorityParam) return new Set();
    return new Set(priorityParam.split(",").filter(Boolean) as TicketPriority[]);
  }, [priorityParam]);
  const overdueOnly = searchParams.get("overdue") === "1";
  const search = searchParams.get("q") ?? "";
  const sortKey = (searchParams.get("sort") as SortKey) ?? "default";
  const vendorFilter = searchParams.get("vendor") ?? ""; // "", "any", "none", or vendor uuid

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value == null || value === "") next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  // Load
  useEffect(() => {
    let cancelled = false;
    // Fire-and-forget background sweep (throttled to 6h).
    void processSystemAutomations();
    (async () => {
      setLoading(true);
      const [{ data: tix }, { data: ppl }] = await Promise.all([
        supabase.from("tickets").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("people").select("id, first_name, last_name, is_self"),
      ]);
      if (cancelled) return;
      const list = (tix ?? []) as TicketRow[];
      setRows(list);
      const pmap: Record<string, { first_name: string; last_name: string }> = {};
      let mySelf: string | null = null;
      for (const p of ppl ?? []) {
        pmap[(p as any).id] = { first_name: (p as any).first_name, last_name: (p as any).last_name };
        if ((p as any).is_self) mySelf = (p as any).id;
      }
      setPeople(pmap);
      setSelfPersonId(mySelf);
      // Load vendor mini-records for any referenced vendor_ids.
      const vendorIds = Array.from(new Set(list.map((r) => r.vendor_id).filter(Boolean) as string[]));
      if (vendorIds.length > 0) {
        const { data: vs } = await supabase
          .from("vendors")
          .select("id, legal_name, display_name, vendor_number")
          .in("id", vendorIds);
        if (!cancelled) {
          const vmap: Record<string, { legal_name: string; display_name: string | null; vendor_number: string }> = {};
          for (const v of vs ?? []) {
            vmap[(v as any).id] = {
              legal_name: (v as any).legal_name,
              display_name: (v as any).display_name,
              vendor_number: (v as any).vendor_number,
            };
          }
          setVendors(vmap);
        }
      }
      // Resolve target labels
      const labels = await resolveTicketTargetLabels(
        list.map((t) => ({ type: t.target_entity_type, id: t.target_entity_id })),
      );
      if (!cancelled) setTargetLabels(labels);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // KPIs (over all rows, not filtered)
  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const open = rows.filter((r) => ACTIVE_TICKET_STATUSES.includes(r.status)).length;
    const overdue = rows.filter((r) => isTicketOverdue(r)).length;
    const urgent = rows.filter(
      (r) => r.priority === "urgent" && ACTIVE_TICKET_STATUSES.includes(r.status),
    ).length;
    const awaitingMe = rows.filter(
      (r) =>
        selfPersonId &&
        r.assignee_id === selfPersonId &&
        ACTIVE_TICKET_STATUSES.includes(r.status),
    ).length;
    const costPending = rows.filter((r) => r.cost_approval_status === "pending").length;
    return { open, overdue, urgent, awaitingMe, costPending };
  }, [rows, selfPersonId]);

  // Filter + sort
  const filtered = useMemo(() => {
    let out = rows.filter((r) => statuses.has(r.status));
    if (priorities.size > 0) out = out.filter((r) => priorities.has(r.priority));
    if (overdueOnly) out = out.filter(isTicketOverdue);
    if (vendorFilter === "any") out = out.filter((r) => r.vendor_id !== null);
    else if (vendorFilter === "none") out = out.filter((r) => r.vendor_id === null);
    else if (vendorFilter) out = out.filter((r) => r.vendor_id === vendorFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (r) =>
          r.ticket_number.toLowerCase().includes(q) ||
          r.subject.toLowerCase().includes(q),
      );
    }
    const sorted = [...out];
    if (sortKey === "default") {
      sorted.sort((a, b) => {
        const p = TICKET_PRIORITY_RANK[a.priority] - TICKET_PRIORITY_RANK[b.priority];
        if (p !== 0) return p;
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        if (da !== db) return da - db;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else if (sortKey === "ticket_number") {
      sorted.sort((a, b) => a.ticket_number.localeCompare(b.ticket_number));
    } else if (sortKey === "subject") {
      sorted.sort((a, b) => a.subject.localeCompare(b.subject));
    } else if (sortKey === "priority") {
      sorted.sort((a, b) => TICKET_PRIORITY_RANK[a.priority] - TICKET_PRIORITY_RANK[b.priority]);
    } else if (sortKey === "status") {
      sorted.sort((a, b) => a.status.localeCompare(b.status));
    } else if (sortKey === "due") {
      sorted.sort((a, b) => {
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return da - db;
      });
    } else if (sortKey === "age") {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return sorted;
  }, [rows, statuses, priorities, overdueOnly, search, sortKey, vendorFilter]);

  const toggleStatus = (s: TicketStatus) => {
    const next = new Set(statuses);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    updateParam("status", Array.from(next).join(","));
  };
  const togglePriority = (p: TicketPriority) => {
    const next = new Set(priorities);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    updateParam("priority", Array.from(next).join(","));
  };
  const clearAll = () => {
    setSearchParams({}, { replace: true });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Tickets"
        description="Track maintenance, requests, admin tasks, and follow-ups across your portfolio."
        actions={
          <Button variant="gold" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New ticket
          </Button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        <KpiCard
          label="Open"
          value={kpis.open}
          sub="All active tickets"
          icon={<TicketIcon className="h-4 w-4" />}
          onClick={() => updateParam("status", ACTIVE_TICKET_STATUSES.join(","))}
        />
        <KpiCard
          label="Overdue"
          value={kpis.overdue}
          sub="Past due date"
          icon={<Clock className="h-4 w-4" />}
          tone={kpis.overdue > 0 ? "red" : undefined}
          onClick={() => updateParam("overdue", "1")}
        />
        <KpiCard
          label="Urgent"
          value={kpis.urgent}
          sub="High-priority active"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={kpis.urgent > 0 ? "amber" : undefined}
          onClick={() => updateParam("priority", "urgent")}
        />
        <KpiCard
          label="Awaiting me"
          value={kpis.awaitingMe}
          sub={selfPersonId ? "My open tickets" : "Link your profile in Settings"}
          icon={<UserIcon className="h-4 w-4" />}
        />
        <KpiCard
          label="Cost approvals"
          value={kpis.costPending}
          sub="Pending review"
          icon={<Coins className="h-4 w-4" />}
          tone={kpis.costPending > 0 ? "amber" : undefined}
        />
      </div>

      {/* Filter bar */}
      <div className="border hairline rounded-sm bg-card p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search ticket # or subject…"
              value={search}
              onChange={(e) => updateParam("q", e.target.value || null)}
              className="h-9 pl-9"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-architect cursor-pointer">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => updateParam("overdue", e.target.checked ? "1" : null)}
            />
            Overdue only
          </label>
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs">
            <X className="h-3 w-3 mr-1" />
            Clear all
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-eyebrow mr-1">Status</span>
          {TICKET_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={cn(
                "px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider",
                statuses.has(s)
                  ? "bg-architect text-chalk border-architect"
                  : "bg-card text-muted-foreground border-warm-stone hover:bg-muted/40",
              )}
            >
              {TICKET_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-eyebrow mr-1">Priority</span>
          {TICKET_PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePriority(p)}
              className={cn(
                "px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider",
                priorities.has(p)
                  ? "bg-architect text-chalk border-architect"
                  : "bg-card text-muted-foreground border-warm-stone hover:bg-muted/40",
              )}
            >
              {TICKET_PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-eyebrow mr-1">Vendor</span>
          {[
            { key: "", label: "All" },
            { key: "any", label: "Assigned" },
            { key: "none", label: "Unassigned" },
          ].map((v) => (
            <button
              key={v.key || "all"}
              type="button"
              onClick={() => updateParam("vendor", v.key || null)}
              className={cn(
                "px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider",
                (vendorFilter || "") === v.key
                  ? "bg-architect text-chalk border-architect"
                  : "bg-card text-muted-foreground border-warm-stone hover:bg-muted/40",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="h-64 bg-muted/40 animate-pulse rounded-sm" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<TicketIcon className="h-8 w-8" strokeWidth={1.2} />}
          title="No tickets yet"
          description="Create one to start tracking work across your properties."
          action={
            <Button variant="gold" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New ticket
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CircleAlert className="h-8 w-8" strokeWidth={1.2} />}
          title="No tickets match these filters"
          action={
            <Button variant="outline" onClick={clearAll}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="border hairline rounded-sm overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b hairline text-left">
                <tr>
                  <ColHeader label="TKT #" sortKey="ticket_number" current={sortKey} onSort={(k) => updateParam("sort", k)} />
                  <ColHeader label="Subject" sortKey="subject" current={sortKey} onSort={(k) => updateParam("sort", k)} />
                  <th className="px-4 py-3 label-eyebrow">Type</th>
                  <ColHeader label="Priority" sortKey="priority" current={sortKey} onSort={(k) => updateParam("sort", k)} />
                  <ColHeader label="Status" sortKey="status" current={sortKey} onSort={(k) => updateParam("sort", k)} />
                  <th className="px-4 py-3 label-eyebrow">Target</th>
                  <th className="px-4 py-3 label-eyebrow">Assignee</th>
                  <th className="px-4 py-3 label-eyebrow">Vendor</th>
                  <ColHeader label="Due" sortKey="due" current={sortKey} onSort={(k) => updateParam("sort", k)} />
                  <ColHeader label="Age" sortKey="age" current={sortKey} onSort={(k) => updateParam("sort", k)} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const overdue = isTicketOverdue(t);
                  const targetKey = `${t.target_entity_type}:${t.target_entity_id}`;
                  const targetLabel = targetLabels[targetKey] ?? "—";
                  const assignee = t.assignee_id ? people[t.assignee_id] : null;
                  return (
                    <tr
                      key={t.id}
                      className="border-b hairline last:border-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/tickets/${t.id}`)}
                    >
                      <td className="px-4 py-3 mono text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {t.ticket_number}
                          {t.is_system_generated && (
                            <span className="text-[9px] uppercase tracking-wider italic text-muted-foreground">
                              {(t as TicketRow & { generated_by_schedule_id?: string | null }).generated_by_schedule_id ? "scheduled" : "auto"}
                            </span>
                          )}
                          {t.cost_approval_status === "pending" && (
                            <Coins className="h-3 w-3 text-amber-700" aria-label="Cost approval pending" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[280px]">
                        <span className="block truncate text-architect" title={t.subject}>
                          {t.subject}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        <span className="text-[10px] uppercase tracking-wider text-true-taupe block">
                          {TICKET_TYPE_CATEGORY(t.ticket_type)}
                        </span>
                        <span>{TICKET_TYPE_LABELS[t.ticket_type as keyof typeof TICKET_TYPE_LABELS] ?? t.ticket_type}</span>
                      </td>
                      <td className="px-4 py-3"><TicketPriorityPill priority={t.priority} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <TicketStatusPill status={t.status} />
                          {t.status === "awaiting" && t.waiting_on && (
                            <span
                              className="h-2 w-2 rounded-full bg-amber-500"
                              title={`Waiting on: ${WAITING_ON_LABELS[t.waiting_on]}`}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[220px] text-xs text-muted-foreground">
                        <span className="block truncate" title={targetLabel}>{targetLabel}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {assignee ? (
                          <span className="text-architect">{assignee.first_name} {assignee.last_name}</span>
                        ) : (
                          <span className="text-muted-foreground italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {t.vendor_id && vendors[t.vendor_id] ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); navigate(`/vendors/${t.vendor_id}`); }}
                            className="text-architect hover:underline truncate max-w-[160px] inline-block text-left"
                            title={vendors[t.vendor_id].display_name || vendors[t.vendor_id].legal_name}
                          >
                            {vendors[t.vendor_id].display_name || vendors[t.vendor_id].legal_name}
                          </button>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </td>
                      <td className={cn("px-4 py-3 text-xs whitespace-nowrap", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                        {t.due_date ? format(new Date(t.due_date), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}

function KpiCard({
  label, value, sub, icon, tone, onClick,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  tone?: "amber" | "red";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border hairline rounded-sm bg-card p-4 text-left hover:bg-muted/30 transition-colors",
        tone === "red" && "border-destructive/40",
        tone === "amber" && "border-amber-500/40",
      )}
    >
      <div className="flex items-center justify-between text-true-taupe">
        <span className="label-eyebrow">{label}</span>
        <span className={cn(tone === "red" && "text-destructive", tone === "amber" && "text-amber-700")}>{icon}</span>
      </div>
      <div className={cn(
        "font-display text-3xl mt-2",
        tone === "red" ? "text-destructive" : tone === "amber" ? "text-amber-700" : "text-architect",
      )}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </button>
  );
}

function ColHeader({
  label, sortKey, current, onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: string;
  onSort: (k: SortKey) => void;
}) {
  return (
    <th className="px-4 py-3 label-eyebrow">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-architect",
          current === sortKey && "text-architect",
        )}
      >
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );
}