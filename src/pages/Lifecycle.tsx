import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { processSystemAutomations } from "@/lib/automations";
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  TableIcon,
  Building2,
  Workflow,
  CheckCircle2,
  X,
  Plus,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { ContractStatusPill } from "@/components/contracts/StatusPill";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatEnumLabel } from "@/lib/format";
import {
  fetchLifecycleData,
  type LifecycleData,
  type LifecycleStage,
  type LifecycleCard,
  type LifecycleLease,
  type LifecycleCheque,
  type LifecycleUnit,
  LIFECYCLE_STAGE_LABELS,
  LIFECYCLE_STAGE_SUBLABELS,
  LIFECYCLE_STAGE_STYLES,
  LIFECYCLE_STAGE_ORDER,
  daysBetween,
} from "@/lib/lifecycle";
import { DepositChequeDialog } from "@/components/contracts/lease/dialogs/DepositChequeDialog";
import { BounceChequeDialog } from "@/components/contracts/lease/dialogs/BounceChequeDialog";

/* =========================================================
 * Helpers
 * ========================================================= */

function fmtMoney(amount: number | null | undefined, currency = "AED"): string {
  if (amount == null) return "—";
  return `${currency} ${Number(amount).toLocaleString()}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/* =========================================================
 * Page
 * ========================================================= */

export default function LifecyclePage() {
  const navigate = useNavigate();
  const [data, setData] = useState<LifecycleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [buildingFilter, setBuildingFilter] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"pipeline" | "table">("pipeline");

  const [highlightStage, setHighlightStage] = useState<LifecycleStage | null>(null);
  const stageRefs = useRef<Record<LifecycleStage, HTMLDivElement | null>>({
    vacant: null, not_ready: null, in_signing: null, active: null, ending_soon: null, recently_ended: null,
  });

  // Cheque action dialogs (still used by table view actions if surfaced elsewhere)
  const [depositCheque, setDepositCheque] = useState<LifecycleCheque | null>(null);
  const [bounceCheque, setBounceCheque] = useState<LifecycleCheque | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const d = await fetchLifecycleData();
      setData(d);
    } catch (e: any) {
      setErr(e.message ?? "Could not load lifecycle data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void processSystemAutomations();
    load();
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [search]);

  /* ============= Filtering ============= */
  const filtered = useMemo(() => {
    if (!data) return null;
    const buildingActive = buildingFilter.size > 0;
    const q = debouncedSearch;

    const matchesBuilding = (buildingId: string) => !buildingActive || buildingFilter.has(buildingId);

    const cardMatchesSearch = (c: LifecycleCard) => {
      if (!q) return true;
      const hay = [
        c.unit.unit_number,
        c.unit.building_name,
        c.lease?.tenant_name ?? "",
        c.lease?.contract_number ?? "",
      ].join(" ").toLowerCase();
      return hay.includes(q);
    };

    const byStage = LIFECYCLE_STAGE_ORDER.reduce((acc, s) => {
      acc[s] = data.byStage[s].filter((c) => matchesBuilding(c.unit.building_id) && cardMatchesSearch(c));
      return acc;
    }, {} as Record<LifecycleStage, LifecycleCard[]>);

    const expiringSoon = data.expiringSoon.filter((l) => {
      const u = data.units.find((x) => x.id === l.unit_id);
      if (!u || !matchesBuilding(u.building_id)) return false;
      if (!q) return true;
      return [l.tenant_name ?? "", u.unit_number, u.building_name, l.contract_number].join(" ").toLowerCase().includes(q);
    });

    const overdueCheques = data.overdueCheques.filter((c) => {
      const u = data.units.find((x) => x.unit_number === c.unit_number);
      if (buildingActive && (!u || !buildingFilter.has(u.building_id))) return false;
      if (!q) return true;
      return [c.tenant_name ?? "", c.unit_number ?? "", c.building_name ?? "", c.contract_number].join(" ").toLowerCase().includes(q);
    });

    const dataGaps = data.dataGaps.filter((u) => {
      if (!matchesBuilding(u.building_id)) return false;
      if (!q) return true;
      return [u.unit_number, u.building_name].join(" ").toLowerCase().includes(q);
    });

    return { byStage, expiringSoon, overdueCheques, dataGaps };
  }, [data, debouncedSearch, buildingFilter]);

  /* ============= KPIs ============= */
  const kpis = useMemo(() => {
    if (!data || !filtered) return null;
    const totalUnits = Object.values(filtered.byStage).reduce((s, arr) => s + arr.length, 0);
    const buildingsCount = buildingFilter.size > 0 ? buildingFilter.size : data.buildings.length;
    const activeCount = filtered.byStage.active.length + filtered.byStage.ending_soon.length;
    const occupancyPct = totalUnits === 0 ? 0 : Math.round((activeCount / totalUnits) * 100);
    const sumActiveRent = [...filtered.byStage.active, ...filtered.byStage.ending_soon]
      .reduce((s, c) => s + (c.lease?.annual_rent ?? 0), 0);
    const expiringSoonCount = filtered.expiringSoon.length;
    const expiringIn30 = filtered.expiringSoon.filter((l) => l.end_date && daysBetween(new Date(), l.end_date) <= 30).length;

    const recentlyEnded = filtered.byStage.recently_ended.length;
    const attentionNeeded = recentlyEnded + filtered.overdueCheques.length + filtered.dataGaps.length;

    return {
      totalUnits,
      buildingsCount,
      vacant: filtered.byStage.vacant.length,
      occupancyPct,
      activeCount,
      sumActiveRent,
      expiringSoonCount,
      expiringIn30,
      attentionNeeded,
    };
  }, [data, filtered, buildingFilter]);

  /* ============= Scroll-to handlers ============= */
  const focusStage = (s: LifecycleStage) => {
    if (view === "table") setView("pipeline");
    setHighlightStage(s);
    setTimeout(() => {
      stageRefs.current[s]?.scrollIntoView({ behavior: "smooth", block: "start", inline: "start" });
    }, 50);
    setTimeout(() => setHighlightStage(null), 2000);
  };

  const focusAttention = (k: "expiring" | "overdue" | "gaps") => {
    attentionRefs.current[k]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* ============= Render ============= */
  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Module" title="Lease Lifecycle" description="Where every unit is in its placement and tenancy journey." />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/40 animate-pulse rounded-sm" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-96 bg-muted/30 animate-pulse rounded-sm" />
          ))}
        </div>
      </>
    );
  }

  if (err) {
    return (
      <>
        <PageHeader eyebrow="Module" title="Lease Lifecycle" />
        <div className="border hairline rounded-sm bg-card p-8 text-center text-destructive text-sm">
          {err}
          <div className="mt-3"><Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3 w-3" /> Retry</Button></div>
        </div>
      </>
    );
  }

  if (!data || data.units.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Module" title="Lease Lifecycle" description="Where every unit is in its placement and tenancy journey." />
        <EmptyState
          icon={<Workflow className="h-10 w-10" strokeWidth={1.2} />}
          title="No properties yet"
          description="Add your first building and units to see the lifecycle pipeline."
          action={
            <Button variant="gold" onClick={() => navigate("/properties")}>
              <Plus className="h-4 w-4" /> Go to Properties
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Module"
        title="Lease Lifecycle"
        description="Where every unit is in its placement and tenancy journey."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        }
      />

      {/* ============= KPI strip ============= */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard
            label="Total units"
            value={kpis.totalUnits}
            sublabel={`${kpis.buildingsCount} building${kpis.buildingsCount === 1 ? "" : "s"}`}
            onClick={() => focusStage("active")}
          />
          <KpiCard
            label="Vacant & ready"
            value={kpis.vacant}
            sublabel="Ready to list"
            tone={kpis.vacant > 0 ? "amber" : "neutral"}
            onClick={() => focusStage("vacant")}
          />
          <KpiCard
            label="Occupancy"
            value={`${kpis.occupancyPct}%`}
            sublabel={`${kpis.activeCount} of ${kpis.totalUnits} occupied`}
            onClick={() => focusStage("active")}
          />
          <KpiCard
            label="Active leases"
            value={kpis.activeCount}
            sublabel={`${fmtMoney(kpis.sumActiveRent)} annual`}
            onClick={() => focusStage("active")}
          />
          <KpiCard
            label="Expiring soon"
            value={kpis.expiringSoonCount}
            sublabel="Next 90 days"
            tone={kpis.expiringIn30 > 0 ? "red" : kpis.expiringSoonCount > 0 ? "amber" : "neutral"}
            onClick={() => focusStage("ending_soon")}
          />
          <KpiCard
            label="Attention needed"
            value={kpis.attentionNeeded}
            sublabel="Requires action"
            tone={kpis.attentionNeeded > 0 ? "red" : "neutral"}
            onClick={() => focusAttention("expiring")}
          />
        </div>
      )}

      {/* ============= Filter bar ============= */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search unit, tenant, contract #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-architect"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <BuildingFilter
          buildings={data.buildings}
          selected={buildingFilter}
          onChange={setBuildingFilter}
        />

        <div className="md:ml-auto inline-flex border hairline rounded-sm overflow-hidden">
          <button
            onClick={() => setView("pipeline")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider transition-colors",
              view === "pipeline" ? "bg-architect text-chalk" : "bg-card text-muted-foreground hover:text-architect",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
          </button>
          <button
            onClick={() => setView("table")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider transition-colors border-l hairline",
              view === "table" ? "bg-architect text-chalk" : "bg-card text-muted-foreground hover:text-architect",
            )}
          >
            <TableIcon className="h-3.5 w-3.5" /> Table
          </button>
        </div>
      </div>

      {/* ============= Pipeline / Table ============= */}
      {view === "pipeline" && filtered && (
        <div className="overflow-x-auto pb-2 mb-10">
          <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-3 min-w-full">
            {LIFECYCLE_STAGE_ORDER.map((stage) => (
              <PipelineColumn
                key={stage}
                stage={stage}
                cards={filtered.byStage[stage]}
                highlight={highlightStage === stage}
                refCb={(el) => { stageRefs.current[stage] = el; }}
                onCardClick={(c) => {
                  if (c.lease) navigate(`/contracts/${c.lease.contract_id}`);
                  else navigate(`/properties/${c.unit.building_id}/units/${c.unit.id}`);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {view === "table" && filtered && (
        <LifecycleTable
          byStage={filtered.byStage}
          onRowClick={(c) => {
            if (c.lease) navigate(`/contracts/${c.lease.contract_id}`);
            else navigate(`/properties/${c.unit.building_id}/units/${c.unit.id}`);
          }}
        />
      )}

      {/* ============= Attention sections ============= */}
      {filtered && (
        <div className="space-y-4 mt-10">
          <AttentionSection
            refSet={(el) => { attentionRefs.current.expiring = el; }}
            title="Expiring in the next 90 days"
            count={filtered.expiringSoon.length}
            tone={filtered.expiringSoon.length > 0 ? "amber" : "neutral"}
            empty="No leases expiring in the next 90 days."
          >
            {filtered.expiringSoon.length > 0 && (
              <ExpiringTable leases={filtered.expiringSoon} units={data.units} navigate={navigate} />
            )}
          </AttentionSection>

          <AttentionSection
            refSet={(el) => { attentionRefs.current.overdue = el; }}
            title="Overdue cheques"
            count={filtered.overdueCheques.length}
            tone={filtered.overdueCheques.length > 0 ? "red" : "neutral"}
            empty="No overdue cheques. Nice."
          >
            {filtered.overdueCheques.length > 0 && (
              <OverdueChequesTable
                cheques={filtered.overdueCheques}
                onView={(ch) => navigate(`/contracts/${ch.contract_id}?tab=cheques`)}
                onDeposit={(ch) => setDepositCheque(ch)}
                onBounce={(ch) => setBounceCheque(ch)}
              />
            )}
          </AttentionSection>

          <AttentionSection
            refSet={(el) => { attentionRefs.current.gaps = el; }}
            title="Data gaps"
            count={filtered.dataGaps.length}
            tone={filtered.dataGaps.length > 0 ? "red" : "neutral"}
            empty="No data gaps. Every occupied unit has a lease on file."
          >
            {filtered.dataGaps.length > 0 && (
              <DataGapsTable units={filtered.dataGaps} navigate={navigate} />
            )}
          </AttentionSection>
        </div>
      )}

      {/* ============= Cheque action dialogs ============= */}
      {depositCheque && (
        <DepositChequeDialog
          open
          onOpenChange={(v) => { if (!v) setDepositCheque(null); }}
          chequeId={depositCheque.id}
          contractId={depositCheque.contract_id}
          sequence={depositCheque.sequence_number}
          onSaved={() => { setDepositCheque(null); load(); toast.success("Cheque updated."); }}
        />
      )}
      {bounceCheque && (
        <BounceChequeDialog
          open
          onOpenChange={(v) => { if (!v) setBounceCheque(null); }}
          chequeId={bounceCheque.id}
          contractId={bounceCheque.contract_id}
          sequence={bounceCheque.sequence_number}
          onSaved={() => { setBounceCheque(null); load(); }}
        />
      )}
    </>
  );
}

/* =========================================================
 * KPI Card
 * ========================================================= */
function KpiCard({
  label, value, sublabel, tone = "neutral", onClick,
}: {
  label: string; value: number | string; sublabel?: string;
  tone?: "neutral" | "amber" | "red"; onClick?: () => void;
}) {
  const toneClass =
    tone === "red" ? "text-destructive" :
    tone === "amber" ? "text-amber-700" : "text-architect";
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left border hairline rounded-sm bg-card px-4 py-3 transition-all",
        "hover:shadow-sm hover:border-warm-stone",
      )}
    >
      <div className="label-eyebrow text-muted-foreground text-[10px]">{label}</div>
      <div className={cn("font-display text-3xl mt-1 leading-none", toneClass)}>{value}</div>
      {sublabel && <div className="text-[11px] text-muted-foreground mt-1.5">{sublabel}</div>}
    </button>
  );
}

/* =========================================================
 * Building filter (popover)
 * ========================================================= */
function BuildingFilter({
  buildings, selected, onChange,
}: {
  buildings: { id: string; name: string }[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const label = selected.size === 0
    ? "All buildings"
    : selected.size === 1
      ? buildings.find((b) => selected.has(b.id))?.name ?? "1 building"
      : `${selected.size} buildings`;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 normal-case tracking-normal text-sm font-normal">
          <Building2 className="h-3.5 w-3.5" />
          <span className="text-architect">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="flex items-center justify-between px-2 py-1">
          <div className="label-eyebrow">Filter by building</div>
          {selected.size > 0 && (
            <button onClick={() => onChange(new Set())} className="text-[10px] text-muted-foreground hover:text-architect uppercase tracking-wider">
              Clear
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {buildings.map((b) => (
            <label key={b.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/40 cursor-pointer rounded-sm">
              <Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggle(b.id)} />
              <span className="text-sm">{b.name}</span>
            </label>
          ))}
          {buildings.length === 0 && <div className="px-2 py-3 text-xs text-muted-foreground">No buildings.</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* =========================================================
 * Pipeline column + cards
 * ========================================================= */
function PipelineColumn({
  stage, cards, highlight, refCb, onCardClick,
}: {
  stage: LifecycleStage;
  cards: LifecycleCard[];
  highlight: boolean;
  refCb: (el: HTMLDivElement | null) => void;
  onCardClick: (c: LifecycleCard) => void;
}) {
  return (
    <div
      ref={refCb}
      className={cn(
        "border hairline rounded-sm bg-muted/20 flex flex-col min-h-[420px] max-h-[720px] transition-shadow",
        highlight && "ring-2 ring-gold shadow-md",
      )}
    >
      <div className="px-3 py-3 border-b hairline bg-card">
        <div className="flex items-center justify-between">
          <div className="label-eyebrow text-architect">{LIFECYCLE_STAGE_LABELS[stage]}</div>
          <span className="mono text-[10px] px-1.5 py-0.5 bg-architect text-chalk rounded-sm">{cards.length}</span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">{LIFECYCLE_STAGE_SUBLABELS[stage]}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {cards.length === 0 ? (
          <div className="text-center text-[11px] italic text-muted-foreground py-8">No {LIFECYCLE_STAGE_LABELS[stage].toLowerCase()} items</div>
        ) : (
          cards.map((c) => <PipelineCard key={c.key} card={c} onClick={() => onCardClick(c)} />)
        )}
      </div>
    </div>
  );
}

function MiniBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "amber" | "red" | "green" }) {
  const styles =
    tone === "red" ? "bg-destructive/10 text-destructive border-destructive/30" :
    tone === "amber" ? "bg-amber-500/10 text-amber-700 border-amber-500/30" :
    tone === "green" ? "bg-status-occupied/10 text-status-occupied border-status-occupied/30" :
    "bg-warm-stone/40 text-true-taupe border-warm-stone";
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border text-[9px] uppercase tracking-wider font-medium", styles)}>
      {children}
    </span>
  );
}

function PipelineCard({ card, onClick }: { card: LifecycleCard; onClick: () => void }) {
  const u = card.unit;
  const l = card.lease;

  // Render variants per stage
  if (card.stage === "vacant") {
    const days = u.vacant_since ? daysBetween(u.vacant_since, new Date()) : null;
    return (
      <CardShell onClick={onClick}>
        <div className="font-display text-base text-architect leading-tight">{u.unit_number}</div>
        <div className="text-[11px] text-muted-foreground">{u.building_name}</div>
        <div className="text-[10px] text-muted-foreground/80 mt-0.5">
          {formatEnumLabel(u.unit_type)}{u.floor != null ? ` · Floor ${u.floor}` : ""}
        </div>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {days != null && <MiniBadge>Vacant {days}d</MiniBadge>}
          {!u.has_mgmt_agreement && <MiniBadge tone="red">No mgmt agreement</MiniBadge>}
        </div>
      </CardShell>
    );
  }

  if (card.stage === "not_ready") {
    return (
      <CardShell onClick={onClick}>
        <div className="flex items-start justify-between gap-2">
          <div className="font-display text-base text-architect leading-tight">{u.unit_number}</div>
          <StatusBadge status={u.status} />
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">{u.building_name}</div>
        {u.vacant_since && (
          <div className="text-[10px] text-muted-foreground/80 mt-1">Since {fmtDate(u.vacant_since)}</div>
        )}
      </CardShell>
    );
  }

  if (card.stage === "in_signing" && l) {
    const ageDays = daysBetween(l.created_at, new Date());
    return (
      <CardShell onClick={onClick}>
        <ContractStatusPill status={l.contract_status} />
        <div className="font-display text-sm text-architect mt-1.5 truncate">{l.tenant_name ?? "Tenant TBD"}</div>
        <div className="text-[11px] text-muted-foreground">{u.unit_number} · {u.building_name}</div>
        {l.annual_rent != null && (
          <div className="text-[11px] text-architect mt-1">{fmtMoney(l.annual_rent, l.currency)}/year</div>
        )}
        <div className="text-[10px] text-muted-foreground/80 mt-1">{ageDays}d in flight</div>
      </CardShell>
    );
  }

  if ((card.stage === "active" || card.stage === "ending_soon") && l) {
    const days = l.end_date ? daysBetween(new Date(), l.end_date) : null;
    const isUrgent = days != null && days <= 30;
    return (
      <CardShell onClick={onClick}>
        <div className="font-display text-sm text-architect truncate">{l.tenant_name ?? "—"}</div>
        <div className="text-[11px] text-muted-foreground">{u.unit_number} · {u.building_name}</div>
        {l.end_date && (
          <div className={cn(
            "text-[11px] mt-1",
            card.stage === "ending_soon" ? (isUrgent ? "text-destructive font-medium" : "text-amber-700") : "text-muted-foreground",
          )}>
            {card.stage === "ending_soon" ? `${days}d left` : `Until ${fmtDate(l.end_date)}`}
          </div>
        )}
        {l.annual_rent != null && (
          <div className="text-[11px] text-architect mt-1">{fmtMoney(l.annual_rent, l.currency)}/year</div>
        )}
        {l.next_pending_cheque && (
          <div className="mt-2">
            <MiniBadge tone={l.next_pending_cheque.days_until < 0 ? "red" : l.next_pending_cheque.days_until <= 7 ? "amber" : "neutral"}>
              {l.currency} {Number(l.next_pending_cheque.amount).toLocaleString()} {l.next_pending_cheque.days_until < 0
                ? `overdue ${Math.abs(l.next_pending_cheque.days_until)}d`
                : `due in ${l.next_pending_cheque.days_until}d`}
            </MiniBadge>
          </div>
        )}
      </CardShell>
    );
  }

  if (card.stage === "recently_ended" && l) {
    const ref = l.terminated_at ?? l.end_date;
    const ago = ref ? daysBetween(ref, new Date()) : null;
    const reason = l.terminated_reason ?? (l.contract_status === "expired" ? "Expired" : formatEnumLabel(l.contract_status));
    return (
      <CardShell onClick={onClick}>
        <div className="font-display text-sm text-architect truncate">{l.tenant_name ?? "—"}</div>
        <div className="text-[11px] text-muted-foreground">{u.unit_number} · {u.building_name}</div>
        <div className="text-[11px] text-muted-foreground/90 mt-1">
          Ended {ago != null ? `${ago}d ago` : "—"} · {reason}
        </div>
        <div className="text-[10px] text-muted-foreground/80 mt-1">Unit: {formatEnumLabel(u.status)}</div>
      </CardShell>
    );
  }

  return null;
}

function CardShell({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="block w-full text-left bg-card border hairline rounded-sm p-2.5 hover:shadow-md hover:border-warm-stone transition-all"
    >
      {children}
    </button>
  );
}

/* =========================================================
 * Attention section
 * ========================================================= */
function AttentionSection({
  title, count, tone, empty, children, refSet,
}: {
  title: string; count: number; tone: "neutral" | "amber" | "red"; empty: string;
  children?: ReactNode; refSet?: (el: HTMLDivElement | null) => void;
}) {
    const [open, setOpen] = useState(true);
    const toneClass = tone === "red" ? "text-destructive" : tone === "amber" ? "text-amber-700" : "text-muted-foreground";
    return (
      <div ref={refSet} className="border hairline rounded-sm bg-card overflow-hidden">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <div className="label-eyebrow text-architect">{title}</div>
            <span className={cn("mono text-[11px] px-2 py-0.5 rounded-sm border", count > 0 ? "border-current bg-card" : "border-warm-stone bg-muted/30 text-muted-foreground", count > 0 && toneClass)}>
              {count}
            </span>
          </div>
        </button>
        {open && (
          <div className="border-t hairline">
            {count === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground italic flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-status-occupied" /> {empty}
              </div>
            ) : children}
          </div>
        )}
      </div>
    );
}

/* Tables for attention sections */
function ExpiringTable({ leases, units, navigate }: { leases: LifecycleLease[]; units: LifecycleUnit[]; navigate: (p: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-left">
          <tr>
            <th className="px-4 py-2 label-eyebrow">Tenant</th>
            <th className="px-4 py-2 label-eyebrow">Unit · Building</th>
            <th className="px-4 py-2 label-eyebrow">Days remaining</th>
            <th className="px-4 py-2 label-eyebrow">Annual rent</th>
            <th className="px-4 py-2 label-eyebrow text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {leases.map((l) => {
            const u = units.find((x) => x.id === l.unit_id);
            const days = l.end_date ? daysBetween(new Date(), l.end_date) : null;
            return (
              <tr key={l.contract_id} className="border-t hairline hover:bg-muted/20">
                <td className="px-4 py-2 text-architect">{l.tenant_name ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{u?.unit_number ?? "—"} · {u?.building_name ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={cn("mono text-xs", days != null && days <= 30 ? "text-destructive font-medium" : "text-amber-700")}>
                    {days != null ? `${days}d` : "—"}
                  </span>
                </td>
                <td className="px-4 py-2 text-architect mono text-xs">{fmtMoney(l.annual_rent, l.currency)}</td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/contracts/${l.contract_id}`)}>View lease</Button>
                  {l.tenant_id && (
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/people/${l.tenant_id}`)}>Contact</Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OverdueChequesTable({
  cheques, onView, onDeposit, onBounce,
}: {
  cheques: LifecycleCheque[];
  onView: (c: LifecycleCheque) => void;
  onDeposit: (c: LifecycleCheque) => void;
  onBounce: (c: LifecycleCheque) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-left">
          <tr>
            <th className="px-4 py-2 label-eyebrow">Cheque #</th>
            <th className="px-4 py-2 label-eyebrow">Tenant</th>
            <th className="px-4 py-2 label-eyebrow">Unit</th>
            <th className="px-4 py-2 label-eyebrow">Amount</th>
            <th className="px-4 py-2 label-eyebrow">Due date</th>
            <th className="px-4 py-2 label-eyebrow">Days overdue</th>
            <th className="px-4 py-2 label-eyebrow text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {cheques.map((c) => (
            <tr key={c.id} className="border-t hairline hover:bg-muted/20">
              <td className="px-4 py-2 mono text-xs text-architect">#{c.sequence_number}</td>
              <td className="px-4 py-2 text-architect">{c.tenant_name ?? "—"}</td>
              <td className="px-4 py-2 text-muted-foreground">{c.unit_number ?? "—"}</td>
              <td className="px-4 py-2 mono text-xs text-architect">{fmtMoney(c.amount)}</td>
              <td className="px-4 py-2 text-muted-foreground text-xs">{fmtDate(c.due_date)}</td>
              <td className="px-4 py-2 mono text-xs text-destructive font-medium">{c.days_overdue}d</td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                <Button variant="ghost" size="sm" onClick={() => onView(c)}>View</Button>
                <Button variant="ghost" size="sm" onClick={() => onDeposit(c)}>Deposit</Button>
                <Button variant="ghost" size="sm" onClick={() => onBounce(c)}>Bounce</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DataGapsTable({ units, navigate }: { units: LifecycleUnit[]; navigate: (p: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-left">
          <tr>
            <th className="px-4 py-2 label-eyebrow">Unit · Building</th>
            <th className="px-4 py-2 label-eyebrow">Status</th>
            <th className="px-4 py-2 label-eyebrow">Since</th>
            <th className="px-4 py-2 label-eyebrow text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => (
            <tr key={u.id} className="border-t hairline hover:bg-muted/20">
              <td className="px-4 py-2 text-architect">{u.unit_number} · <span className="text-muted-foreground">{u.building_name}</span></td>
              <td className="px-4 py-2"><StatusBadge status={u.status} /></td>
              <td className="px-4 py-2 text-muted-foreground text-xs">{fmtDate(u.vacant_since)}</td>
              <td className="px-4 py-2 text-right">
                <Button variant="ghost" size="sm" onClick={() => navigate(`/contracts?type=lease`)}>Add lease</Button>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/properties/${u.building_id}/units/${u.id}`)}>View unit</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================
 * Table view
 * ========================================================= */
type SortKey = "stage" | "unit" | "building" | "tenant" | "rent" | "start" | "end" | "days";

function LifecycleTable({
  byStage, onRowClick,
}: {
  byStage: Record<LifecycleStage, LifecycleCard[]>;
  onRowClick: (c: LifecycleCard) => void;
}) {
  const [sortBy, setSortBy] = useState<SortKey>("stage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const rows = useMemo(() => {
    const all: LifecycleCard[] = [];
    LIFECYCLE_STAGE_ORDER.forEach((s) => all.push(...byStage[s]));

    const stageRank = (s: LifecycleStage) => LIFECYCLE_STAGE_ORDER.indexOf(s);

    const cmp = (a: LifecycleCard, b: LifecycleCard): number => {
      let v = 0;
      switch (sortBy) {
        case "stage": v = stageRank(a.stage) - stageRank(b.stage); break;
        case "unit": v = a.unit.unit_number.localeCompare(b.unit.unit_number); break;
        case "building": v = a.unit.building_name.localeCompare(b.unit.building_name); break;
        case "tenant": v = (a.lease?.tenant_name ?? "").localeCompare(b.lease?.tenant_name ?? ""); break;
        case "rent": v = (a.lease?.annual_rent ?? 0) - (b.lease?.annual_rent ?? 0); break;
        case "start": v = (a.lease?.start_date ?? "").localeCompare(b.lease?.start_date ?? ""); break;
        case "end": v = (a.lease?.end_date ?? "").localeCompare(b.lease?.end_date ?? ""); break;
        case "days": {
          const da = a.lease?.end_date ? daysBetween(new Date(), a.lease.end_date) : Number.MAX_SAFE_INTEGER;
          const db = b.lease?.end_date ? daysBetween(new Date(), b.lease.end_date) : Number.MAX_SAFE_INTEGER;
          v = da - db;
          break;
        }
      }
      return sortDir === "asc" ? v : -v;
    };
    return all.sort(cmp);
  }, [byStage, sortBy, sortDir]);

  const setSort = (k: SortKey) => {
    if (k === sortBy) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(k); setSortDir("asc"); }
  };

  const Th = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <th className={cn("px-4 py-2 label-eyebrow text-left cursor-pointer hover:text-architect", className)} onClick={() => setSort(k)}>
      {label} {sortBy === k && <span className="text-[9px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );

  return (
    <div className="border hairline rounded-sm bg-card overflow-hidden mb-10">
      <div className="flex items-center justify-between px-4 py-2.5 border-b hairline bg-muted/20">
        <div className="text-xs text-muted-foreground">{rows.length} item{rows.length === 1 ? "" : "s"}</div>
        <Button variant="outline" size="sm" disabled title="Coming soon">Export CSV</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <Th k="unit" label="Unit" />
              <Th k="building" label="Building" />
              <Th k="stage" label="Stage" />
              <Th k="tenant" label="Tenant" />
              <Th k="rent" label="Annual rent" />
              <Th k="start" label="Start" />
              <Th k="end" label="End" />
              <Th k="days" label="Days remaining" />
              <th className="px-4 py-2 label-eyebrow">Next action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const days = c.lease?.end_date ? daysBetween(new Date(), c.lease.end_date) : null;
              const nextAction =
                c.stage === "vacant" ? "List unit" :
                c.stage === "in_signing" ? "Complete signing" :
                c.stage === "ending_soon" ? "Renew or turn over" :
                c.stage === "recently_ended" ? "Re-list or follow up" :
                c.stage === "not_ready" ? "Resolve status" : "Monitor";
              return (
                <tr key={c.key} onClick={() => onRowClick(c)} className="border-t hairline hover:bg-muted/20 cursor-pointer">
                  <td className="px-4 py-2 text-architect">{c.unit.unit_number}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.unit.building_name}</td>
                  <td className="px-4 py-2">
                    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider font-medium", LIFECYCLE_STAGE_STYLES[c.stage])}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {LIFECYCLE_STAGE_LABELS[c.stage]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{c.lease?.tenant_name ?? "—"}</td>
                  <td className="px-4 py-2 mono text-xs text-architect">{c.lease?.annual_rent != null ? fmtMoney(c.lease.annual_rent, c.lease.currency) : "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{fmtDate(c.lease?.start_date)}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{fmtDate(c.lease?.end_date)}</td>
                  <td className="px-4 py-2 mono text-xs text-muted-foreground">{days != null ? `${days}d` : "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{nextAction}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
