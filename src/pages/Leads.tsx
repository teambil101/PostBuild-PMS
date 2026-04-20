import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import {
  Plus, Search, X, Target, AlertTriangle, TrendingUp, Trophy, PauseCircle, Activity,
  LayoutGrid, Rows3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { NewLeadDialog } from "@/components/leads/NewLeadDialog";
import { LeadsKanban } from "@/components/leads/kanban/LeadsKanban";
import {
  LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_STATUS_STYLES,
  LEAD_SOURCES, LEAD_SOURCE_LABELS,
  TERMINAL_STATUSES,
  getStageAgingDays, isStageStuck, getStageAgingTone, agingToneClasses,
  getDaysToClose, getWeightedPipelineValue, startOfCurrentQuarterIso,
  type LeadRow, type LeadStatus, type LeadSource,
} from "@/lib/leads";

type PersonLite = { id: string; first_name: string; last_name: string; company: string | null };
type ViewMode = "kanban" | "table";

const VIEW_KEY = "leadsViewMode";

function getInitialView(): ViewMode {
  if (typeof window === "undefined") return "kanban";
  const stored = window.localStorage.getItem(VIEW_KEY) as ViewMode | null;
  if (stored === "kanban" || stored === "table") return stored;
  return window.innerWidth < 1024 ? "table" : "kanban";
}

export default function LeadsPage() {
  const { canEdit } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [people, setPeople] = useState<Record<string, PersonLite>>({});
  const [contractsByLead, setContractsByLead] = useState<Record<string, { id: string; contract_number: string }>>({});
  const [view, setView] = useState<ViewMode>(getInitialView);
  const [showOnHold, setShowOnHold] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // Persist view choice
  useEffect(() => {
    try { window.localStorage.setItem(VIEW_KEY, view); } catch { /* ignore */ }
  }, [view]);

  // Filters via URL
  const search = searchParams.get("q") ?? "";
  const statusParam = searchParams.get("status");
  const statusFilters: LeadStatus[] = useMemo(
    () => (statusParam ? (statusParam.split(",").filter(Boolean) as LeadStatus[]) : []),
    [statusParam],
  );
  const assigneeParam = searchParams.get("assignee") ?? "all"; // all | unassigned | <id>
  const sourceParam = searchParams.get("source");
  const sourceFilters: LeadSource[] = useMemo(
    () => (sourceParam ? (sourceParam.split(",").filter(Boolean) as LeadSource[]) : []),
    [sourceParam],
  );
  const closeFrom = searchParams.get("closeFrom") ?? "";
  const closeTo = searchParams.get("closeTo") ?? "";
  const stuckOnly = searchParams.get("stuck") === "1";
  const filtersUntouched =
    !statusParam && assigneeParam === "all" && !sourceParam && !closeFrom && !closeTo && !stuckOnly && !search;

  const update = (k: string, v: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (v == null || v === "") next.delete(k);
    else next.set(k, v);
    setSearchParams(next, { replace: true });
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("leads").select("*").order("stage_entered_at", { ascending: false });
    const list = ((data ?? []) as unknown as LeadRow[]).map((l) => ({
      ...l,
      proposed_scope_of_services: Array.isArray(l.proposed_scope_of_services)
        ? l.proposed_scope_of_services
        : (l.proposed_scope_of_services as any) ?? [],
    }));
    setLeads(list);

    // Resolve people referenced by leads
    const ids = new Set<string>();
    for (const l of list) {
      ids.add(l.primary_contact_id);
      if (l.company_id) ids.add(l.company_id);
      if (l.assignee_id) ids.add(l.assignee_id);
    }
    if (ids.size > 0) {
      const { data: ppl } = await supabase
        .from("people")
        .select("id, first_name, last_name, company")
        .in("id", Array.from(ids));
      const map: Record<string, PersonLite> = {};
      for (const p of ppl ?? []) map[p.id] = p as PersonLite;
      setPeople(map);
    } else {
      setPeople({});
    }

    // Resolve won contracts (for the Contract Signed column)
    const contractIds = list
      .map((l) => l.won_contract_id)
      .filter((x): x is string => !!x);
    if (contractIds.length > 0) {
      const { data: cs } = await supabase
        .from("contracts")
        .select("id, contract_number")
        .in("id", contractIds);
      const cmap: Record<string, { id: string; contract_number: string }> = {};
      const byContract = new Map((cs ?? []).map((c) => [c.id, c]));
      for (const l of list) {
        if (l.won_contract_id) {
          const c = byContract.get(l.won_contract_id);
          if (c) cmap[l.id] = c;
        }
      }
      setContractsByLead(cmap);
    } else {
      setContractsByLead({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // KPIs
  const kpis = useMemo(() => {
    const active = leads.filter((l) => !TERMINAL_STATUSES.includes(l.status));
    const weighted = getWeightedPipelineValue(active);
    const stuck = active.filter((l) => isStageStuck(l, 14)).length;
    const qStart = startOfCurrentQuarterIso();
    const wonQ = leads.filter(
      (l) => l.status === "contract_signed" && l.won_at && l.won_at >= qStart,
    ).length;
    return { activeCount: active.length, weighted, stuck, wonQ };
  }, [leads]);

  // Default filter: exclude terminal unless user touches a status filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      // Status filter
      if (statusFilters.length > 0) {
        if (!statusFilters.includes(l.status)) return false;
      } else {
        // Default — exclude terminal
        if (TERMINAL_STATUSES.includes(l.status)) return false;
      }
      // Assignee
      if (assigneeParam !== "all") {
        if (assigneeParam === "unassigned") {
          if (l.assignee_id) return false;
        } else if (l.assignee_id !== assigneeParam) {
          return false;
        }
      }
      // Source
      if (sourceFilters.length > 0 && !sourceFilters.includes(l.source)) return false;
      // Target close range
      if (closeFrom && (!l.target_close_date || l.target_close_date < closeFrom)) return false;
      if (closeTo && (!l.target_close_date || l.target_close_date > closeTo)) return false;
      // Stuck only
      if (stuckOnly && !isStageStuck(l, 14)) return false;
      // Search
      if (q) {
        const contact = people[l.primary_contact_id];
        const company = l.company_id ? people[l.company_id] : null;
        const blob = [
          l.lead_number,
          contact ? `${contact.first_name} ${contact.last_name}` : "",
          contact?.company ?? "",
          company?.company ?? "",
          l.portfolio_description ?? "",
          l.notes ?? "",
        ].join(" ").toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [leads, people, search, statusFilters, assigneeParam, sourceFilters, closeFrom, closeTo, stuckOnly]);

  // Kanban applies all filters EXCEPT the implicit "exclude terminal" default.
  // Terminal columns (Contract Signed / Lost) are first-class in the board.
  const kanbanFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilters.length > 0 && !statusFilters.includes(l.status) && l.status !== "on_hold") {
        return false;
      }
      if (assigneeParam !== "all") {
        if (assigneeParam === "unassigned") { if (l.assignee_id) return false; }
        else if (l.assignee_id !== assigneeParam) return false;
      }
      if (sourceFilters.length > 0 && !sourceFilters.includes(l.source)) return false;
      if (closeFrom && (!l.target_close_date || l.target_close_date < closeFrom)) return false;
      if (closeTo && (!l.target_close_date || l.target_close_date > closeTo)) return false;
      if (stuckOnly && !isStageStuck(l, 14)) return false;
      if (q) {
        const contact = people[l.primary_contact_id];
        const company = l.company_id ? people[l.company_id] : null;
        const blob = [
          l.lead_number,
          contact ? `${contact.first_name} ${contact.last_name}` : "",
          contact?.company ?? "",
          company?.company ?? "",
          l.portfolio_description ?? "",
          l.notes ?? "",
        ].join(" ").toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [leads, people, search, statusFilters, assigneeParam, sourceFilters, closeFrom, closeTo, stuckOnly]);

  const assigneeOptions = useMemo(() => {
    const set = new Map<string, PersonLite>();
    for (const l of leads) {
      if (l.assignee_id && people[l.assignee_id]) set.set(l.assignee_id, people[l.assignee_id]);
    }
    return Array.from(set.values()).sort((a, b) => a.first_name.localeCompare(b.first_name));
  }, [leads, people]);

  const toggleStatus = (s: LeadStatus) => {
    const next = new Set(statusFilters);
    if (next.has(s)) next.delete(s); else next.add(s);
    update("status", Array.from(next).join(","));
  };

  const toggleSource = (s: LeadSource) => {
    const next = new Set(sourceFilters);
    if (next.has(s)) next.delete(s); else next.add(s);
    update("source", Array.from(next).join(","));
  };

  const clearAll = () => setSearchParams({}, { replace: true });

  return (
    <>
      <PageHeader
        eyebrow="Module · 09"
        title="Leads"
        description="Prospective management clients in the pipeline."
        actions={
          canEdit && (
            <Button variant="gold" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New lead
            </Button>
          )
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Kpi
          label="Active leads"
          value={kpis.activeCount}
          sub={`${kpis.activeCount} in active pipeline`}
          icon={<Activity className="h-4 w-4" />}
        />
        <Kpi
          label="Weighted pipeline"
          value={formatCurrency(kpis.weighted, "AED")}
          sub="Expected value if probabilities hold"
          icon={<TrendingUp className="h-4 w-4" />}
          tone="gold"
        />
        <Kpi
          label="Stage-stuck"
          value={kpis.stuck}
          sub="Proposal/Negotiating > 14d"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={kpis.stuck > 0 ? "amber" : undefined}
        />
        <Kpi
          label="Won this quarter"
          value={kpis.wonQ}
          sub="Closed-won deals this quarter"
          icon={<Trophy className="h-4 w-4" />}
        />
      </div>

      {/* Filter bar */}
      <div className="border hairline rounded-sm bg-card p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search lead #, contact, company, portfolio…"
              value={search}
              onChange={(e) => update("q", e.target.value || null)}
              className="h-9 pl-9"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-architect cursor-pointer">
            <input
              type="checkbox"
              checked={stuckOnly}
              onChange={(e) => update("stuck", e.target.checked ? "1" : null)}
            />
            Stage-stuck only
          </label>
          {view === "kanban" && (
            <label className="flex items-center gap-2 text-xs text-architect cursor-pointer">
              <input
                type="checkbox"
                checked={showOnHold}
                onChange={(e) => setShowOnHold(e.target.checked)}
              />
              Show on-hold leads
            </label>
          )}
          {!filtersUntouched && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs">
              <X className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          )}
          {/* View toggle */}
          <div className="ml-auto inline-flex border hairline rounded-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={cn(
                "px-2.5 py-1 text-[11px] uppercase tracking-wider flex items-center gap-1.5",
                view === "kanban" ? "bg-architect text-chalk" : "bg-card text-muted-foreground hover:bg-muted/40",
              )}
              title="Kanban view"
            >
              <LayoutGrid className="h-3 w-3" /> Kanban
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={cn(
                "px-2.5 py-1 text-[11px] uppercase tracking-wider flex items-center gap-1.5",
                view === "table" ? "bg-architect text-chalk" : "bg-card text-muted-foreground hover:bg-muted/40",
              )}
              title="Table view"
            >
              <Rows3 className="h-3 w-3" /> Table
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-eyebrow mr-1">Status</span>
          {LEAD_STATUSES.map((s) => {
            const active = statusFilters.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={cn(
                  "px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider",
                  active
                    ? "bg-architect text-chalk border-architect"
                    : "bg-card text-muted-foreground border-warm-stone hover:bg-muted/40",
                )}
              >
                {LEAD_STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-eyebrow mr-1">Source</span>
          {LEAD_SOURCES.map((s) => {
            const active = sourceFilters.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSource(s)}
                className={cn(
                  "px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider",
                  active
                    ? "bg-architect text-chalk border-architect"
                    : "bg-card text-muted-foreground border-warm-stone hover:bg-muted/40",
                )}
              >
                {LEAD_SOURCE_LABELS[s]}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="label-eyebrow">Assignee</span>
            <select
              value={assigneeParam}
              onChange={(e) => update("assignee", e.target.value === "all" ? null : e.target.value)}
              className="h-8 px-2 rounded-sm border border-warm-stone bg-background text-xs"
            >
              <option value="all">All</option>
              <option value="unassigned">Unassigned</option>
              {assigneeOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="label-eyebrow">Target close</span>
            <Input
              type="date"
              value={closeFrom}
              onChange={(e) => update("closeFrom", e.target.value || null)}
              className="h-8 w-36 text-xs"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <Input
              type="date"
              value={closeTo}
              onChange={(e) => update("closeTo", e.target.value || null)}
              className="h-8 w-36 text-xs"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 bg-muted/40 animate-pulse rounded-sm" />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<Target className="h-8 w-8" strokeWidth={1.2} />}
          title="No leads yet"
          description="Track prospective management clients from first contact through contract signing."
          action={
            canEdit && (
              <Button variant="gold" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                New lead
              </Button>
            )
          }
        />
      ) : view === "kanban" ? (
        <LeadsKanban
          leads={kanbanFiltered}
          people={people}
          contractsByLead={contractsByLead}
          showOnHold={showOnHold}
          onChanged={load}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-8 w-8" strokeWidth={1.2} />}
          title="No leads match these filters"
          action={<Button variant="outline" onClick={clearAll}>Clear filters</Button>}
        />
      ) : (
        <div className="border hairline rounded-sm overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b hairline text-left">
                <tr>
                  <th className="px-4 py-3 label-eyebrow">Lead #</th>
                  <th className="px-4 py-3 label-eyebrow">Contact</th>
                  <th className="px-4 py-3 label-eyebrow">Company</th>
                  <th className="px-4 py-3 label-eyebrow">Status</th>
                  <th className="px-4 py-3 label-eyebrow">Stage age</th>
                  <th className="px-4 py-3 label-eyebrow">Est. value</th>
                  <th className="px-4 py-3 label-eyebrow">Prob.</th>
                  <th className="px-4 py-3 label-eyebrow">Assignee</th>
                  <th className="px-4 py-3 label-eyebrow">Target close</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <LeadRowItem key={l.id} lead={l} people={people} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NewLeadDialog open={open} onOpenChange={setOpen} onSaved={() => { setOpen(false); load(); }} />
    </>
  );
}

function LeadRowItem({ lead, people }: { lead: LeadRow; people: Record<string, PersonLite> }) {
  const contact = people[lead.primary_contact_id];
  const company = lead.company_id ? people[lead.company_id] : null;
  const assignee = lead.assignee_id ? people[lead.assignee_id] : null;
  const days = getStageAgingDays(lead);
  const tone = getStageAgingTone(lead);
  const dToClose = getDaysToClose(lead.target_close_date);
  const closeIsOverdue = dToClose != null && dToClose < 0 && !TERMINAL_STATUSES.includes(lead.status);
  const onHold = lead.status === "on_hold";

  return (
    <tr className={cn(
      "border-b hairline last:border-0 hover:bg-muted/30",
      onHold && "bg-amber-500/[0.04]",
    )}>
      <td className="px-4 py-3 mono text-xs text-muted-foreground whitespace-nowrap">
        <Link to={`/leads/${lead.id}`} className="hover:text-architect">{lead.lead_number}</Link>
      </td>
      <td className="px-4 py-3 max-w-[200px]">
        {contact ? (
          <Link to={`/people/${contact.id}`} className="text-architect hover:underline truncate block">
            {contact.first_name} {contact.last_name}
          </Link>
        ) : (
          <span className="text-muted-foreground italic text-xs">Missing contact</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs max-w-[180px]">
        {company ? (
          <Link to={`/people/${company.id}`} className="text-architect hover:underline truncate block">
            {company.company || `${company.first_name} ${company.last_name}`}
          </Link>
        ) : contact?.company ? (
          <span className="text-architect truncate block">{contact.company}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="inline-flex items-center gap-1">
          <span className={cn("px-1.5 py-0.5 border rounded-sm text-[10px] uppercase tracking-wider", LEAD_STATUS_STYLES[lead.status])}>
            {LEAD_STATUS_LABELS[lead.status]}
          </span>
          {onHold && lead.hold_reason && (
            <span title={lead.hold_reason}>
              <PauseCircle className="h-3.5 w-3.5 text-amber-700" />
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={cn("text-xs", agingToneClasses(tone))}>
          {days}d in {LEAD_STATUS_LABELS[lead.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-xs whitespace-nowrap">
        {lead.estimated_annual_fee != null ? (
          <span className="text-architect">{lead.currency} {Number(lead.estimated_annual_fee).toLocaleString()}/yr</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs">
        {lead.probability_percent != null ? (
          <div className="flex items-center gap-1.5 min-w-[70px]">
            <div className="flex-1 h-1.5 bg-muted rounded-sm overflow-hidden">
              <div
                className="h-full bg-gold"
                style={{ width: `${lead.probability_percent}%` }}
              />
            </div>
            <span className="text-architect">{lead.probability_percent}%</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs">
        {assignee ? (
          <span className="text-architect truncate block max-w-[140px]">
            {assignee.first_name} {assignee.last_name}
          </span>
        ) : (
          <span className="text-muted-foreground italic">Unassigned</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs whitespace-nowrap">
        {lead.target_close_date ? (
          <span className={cn(closeIsOverdue ? "text-destructive" : "text-architect")}>
            {format(new Date(lead.target_close_date + "T00:00:00"), "MMM d, yyyy")}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

function Kpi({
  label, value, sub, icon, tone,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon?: React.ReactNode;
  tone?: "gold" | "amber" | "red";
}) {
  return (
    <div className={cn(
      "border hairline rounded-sm p-4 bg-card",
      tone === "gold" && "border-gold/40 bg-gold/[0.03]",
      tone === "amber" && "border-amber-500/40 bg-amber-500/[0.03]",
      tone === "red" && "border-destructive/40 bg-destructive/[0.03]",
    )}>
      <div className="flex items-center justify-between">
        <span className="label-eyebrow text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className={cn(
        "font-display text-3xl mt-2",
        tone === "gold" ? "text-gold" : tone === "amber" ? "text-amber-700" : tone === "red" ? "text-destructive" : "text-architect",
      )}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}
