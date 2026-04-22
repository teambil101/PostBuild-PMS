import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, RefreshCw, ChevronDown, Building2, Workflow, X, Plus,
  LayoutGrid, TableIcon, Tag, ListChecks, ExternalLink, Columns3,
} from "lucide-react";
import { processSystemAutomations } from "@/lib/automations";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatEnumLabel } from "@/lib/format";
import {
  fetchLifecycleData,
  type LifecycleData,
  type LifecycleStage,
  type LifecycleCard,
  LIFECYCLE_STAGE_LABELS,
  LIFECYCLE_STAGE_ORDER,
  LIFECYCLE_STAGE_STYLES,
  daysBetween,
} from "@/lib/lifecycle";
import { FunnelStrip } from "@/components/lifecycle/FunnelStrip";
import { StageSection } from "@/components/lifecycle/StageSection";
import { LifecycleKanban } from "@/components/lifecycle/LifecycleKanban";
import { MarkListedDialog } from "@/components/lifecycle/MarkListedDialog";
import { UnlistDialog } from "@/components/lifecycle/UnlistDialog";

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

function daysSince(d: string | null | undefined): number | null {
  if (!d) return null;
  return daysBetween(d, new Date());
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
  const [view, setView] = useState<"kanban" | "funnel" | "table">("kanban");
  const [highlightStage, setHighlightStage] = useState<LifecycleStage | null>(null);
  const sectionRefs = useRef<Record<LifecycleStage, HTMLDivElement | null>>({
    not_ready: null, ready_unlisted: null, listed: null,
    offer_pending: null, in_signing: null, leased: null,
  });

  const [listDialog, setListDialog] = useState<LifecycleCard | null>(null);
  const [unlistDialog, setUnlistDialog] = useState<LifecycleCard | null>(null);

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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    if (!data) return null;
    const buildingActive = buildingFilter.size > 0;
    const q = debouncedSearch;

    const cardMatches = (c: LifecycleCard) => {
      if (buildingActive && !buildingFilter.has(c.unit.building_id)) return false;
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
      acc[s] = data.byStage[s].filter(cardMatches);
      return acc;
    }, {} as Record<LifecycleStage, LifecycleCard[]>);

    return { byStage };
  }, [data, debouncedSearch, buildingFilter]);

  const counts = useMemo(() => {
    const c: Record<LifecycleStage, number> = {
      not_ready: 0, ready_unlisted: 0, listed: 0,
      offer_pending: 0, in_signing: 0, leased: 0,
    };
    if (!filtered) return c;
    LIFECYCLE_STAGE_ORDER.forEach((s) => { c[s] = filtered.byStage[s].length; });
    return c;
  }, [filtered]);

  const focusStage = (s: LifecycleStage) => {
    if (view === "table") setView("kanban");
    setHighlightStage(s);
    setTimeout(() => {
      sectionRefs.current[s]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    setTimeout(() => setHighlightStage(null), 2000);
  };

  /* ============= Render ============= */
  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Module" title="Leasing Lifecycle" description="From available unit to signed lease." />
        <div className="h-32 bg-muted/40 animate-pulse rounded-sm mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/30 animate-pulse rounded-sm" />
          ))}
        </div>
      </>
    );
  }

  if (err) {
    return (
      <>
        <PageHeader eyebrow="Module" title="Leasing Lifecycle" />
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
        <PageHeader eyebrow="Module" title="Leasing Lifecycle" description="From available unit to signed lease." />
        <EmptyState
          icon={<Workflow className="h-10 w-10" strokeWidth={1.2} />}
          title="No properties yet"
          description="Add your first building and units to see the leasing funnel."
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
        title="Leasing Lifecycle"
        description="From available unit to signed lease."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        }
      />

      {/* Funnel strip */}
      <FunnelStrip
        counts={counts}
        deltas={data.stageDeltas}
        active={highlightStage}
        onSelect={focusStage}
      />

      {/* Filter bar */}
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
            onClick={() => setView("funnel")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider transition-colors",
              view === "funnel" ? "bg-architect text-chalk" : "bg-card text-muted-foreground hover:text-architect",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Funnel
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

      {/* Funnel view: vertical stage sections */}
      {view === "funnel" && filtered && (
        <div className="space-y-4 pb-8">
          {LIFECYCLE_STAGE_ORDER.map((stage) => (
            <StageSection
              key={stage}
              title={LIFECYCLE_STAGE_LABELS[stage]}
              count={filtered.byStage[stage].length}
              refSet={(el) => { sectionRefs.current[stage] = el; }}
              highlight={highlightStage === stage}
              toneClass={LIFECYCLE_STAGE_STYLES[stage]}
              emptyMessage={emptyMessageFor(stage)}
              headerActions={headerActionsFor(stage, navigate)}
            >
              <StageTable
                stage={stage}
                cards={filtered.byStage[stage]}
                onMarkListed={(c) => setListDialog(c)}
                onUnlist={(c) => setUnlistDialog(c)}
                navigate={navigate}
              />
            </StageSection>
          ))}
        </div>
      )}

      {/* Table view */}
      {view === "table" && filtered && (
        <FlatTable
          byStage={filtered.byStage}
          onRowClick={(c) => {
            if (c.lease) navigate(`/contracts/${c.lease.contract_id}`);
            else navigate(`/properties/${c.unit.building_id}/units/${c.unit.id}`);
          }}
        />
      )}

      {/* Listing dialogs */}
      {listDialog && (
        <MarkListedDialog
          open
          onOpenChange={(v) => { if (!v) setListDialog(null); }}
          unitId={listDialog.unit.id}
          unitNumber={listDialog.unit.unit_number}
          buildingName={listDialog.unit.building_name}
          initialAskingRent={listDialog.unit.asking_rent}
          initialCurrency={listDialog.unit.asking_rent_currency}
          initialNotes={listDialog.unit.listing_notes}
          onSaved={() => { setListDialog(null); load(); }}
        />
      )}
      {unlistDialog && (
        <UnlistDialog
          open
          onOpenChange={(v) => { if (!v) setUnlistDialog(null); }}
          unitId={unlistDialog.unit.id}
          unitNumber={unlistDialog.unit.unit_number}
          onSaved={() => { setUnlistDialog(null); load(); }}
        />
      )}
    </>
  );
}

/* =========================================================
 * Per-stage helpers
 * ========================================================= */
function emptyMessageFor(stage: LifecycleStage): string {
  switch (stage) {
    case "not_ready": return "All units are at least ready to list.";
    case "ready_unlisted": return "Every ready unit has been listed. Nice.";
    case "listed": return "No active listings right now.";
    case "offer_pending": return "No offers awaiting landlord confirmation.";
    case "in_signing": return "Nothing currently in signing.";
    case "leased": return "No new leases activated in the last 30 days.";
  }
}

function headerActionsFor(stage: LifecycleStage, navigate: (p: string) => void) {
  if (stage === "leased") {
    return (
      <Button variant="ghost" size="sm" onClick={() => navigate("/contracts?type=lease&status=active")}>
        <ExternalLink className="h-3 w-3" /> All in Contracts
      </Button>
    );
  }
  return null;
}

/* =========================================================
 * Per-stage tables
 * ========================================================= */
function StageTable({
  stage, cards, onMarkListed, onUnlist, navigate,
}: {
  stage: LifecycleStage;
  cards: LifecycleCard[];
  onMarkListed: (c: LifecycleCard) => void;
  onUnlist: (c: LifecycleCard) => void;
  navigate: (p: string) => void;
}) {
  // Each stage gets its own column set
  switch (stage) {
    case "not_ready":
      return (
        <Table headers={["Unit", "Building", "Status", "Since", ""]}>
          {cards.map((c) => (
            <Row key={c.key} onClick={() => navigate(`/properties/${c.unit.building_id}/units/${c.unit.id}`)}>
              <Td primary>{c.unit.unit_number}</Td>
              <Td>{c.unit.building_name}</Td>
              <Td><Pill stage={stage} label={formatEnumLabel(c.unit.status)} /></Td>
              <Td mono>{fmtDate(c.unit.vacant_since)}</Td>
              <Td action>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/properties/${c.unit.building_id}/units/${c.unit.id}`); }}>View unit</Button>
              </Td>
            </Row>
          ))}
        </Table>
      );

    case "ready_unlisted":
      return (
        <Table headers={["Unit", "Building", "Type", "Vacant for", "Mgmt", ""]}>
          {cards.map((c) => {
            const days = daysSince(c.unit.vacant_since);
            return (
              <Row key={c.key} onClick={() => navigate(`/properties/${c.unit.building_id}/units/${c.unit.id}`)}>
                <Td primary>{c.unit.unit_number}</Td>
                <Td>{c.unit.building_name}</Td>
                <Td>{formatEnumLabel(c.unit.unit_type)}{c.unit.floor != null ? ` · F${c.unit.floor}` : ""}</Td>
                <Td mono>{days != null ? `${days}d` : "—"}</Td>
                <Td>{c.unit.has_mgmt_agreement ? <Pill stage="leased" label="Yes" /> : <Pill stage="not_ready" label="No" />}</Td>
                <Td action>
                  <Button variant="gold" size="sm" onClick={(e) => { e.stopPropagation(); onMarkListed(c); }}>
                    <Tag className="h-3 w-3" /> Mark listed
                  </Button>
                </Td>
              </Row>
            );
          })}
        </Table>
      );

    case "listed":
      return (
        <Table headers={["Unit", "Building", "Asking", "Listed", "Days listed", ""]}>
          {cards.map((c) => {
            const days = daysSince(c.unit.listed_at);
            return (
              <Row key={c.key} onClick={() => navigate(`/properties/${c.unit.building_id}/units/${c.unit.id}`)}>
                <Td primary>{c.unit.unit_number}</Td>
                <Td>{c.unit.building_name}</Td>
                <Td mono>{fmtMoney(c.unit.asking_rent, c.unit.asking_rent_currency ?? "AED")}</Td>
                <Td mono>{fmtDate(c.unit.listed_at)}</Td>
                <Td mono>{days != null ? `${days}d` : "—"}</Td>
                <Td action>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onUnlist(c); }}>
                    Unlist
                  </Button>
                </Td>
              </Row>
            );
          })}
        </Table>
      );

    case "offer_pending":
      return (
        <Table headers={["Unit", "Building", "Tenant", "Proposed rent", "Awaiting for", ""]}>
          {cards.map((c) => {
            const l = c.lease!;
            const ageDays = daysSince(l.created_at);
            return (
              <Row key={c.key} onClick={() => navigate(`/contracts/${l.contract_id}`)}>
                <Td primary>{c.unit.unit_number}</Td>
                <Td>{c.unit.building_name}</Td>
                <Td>{l.tenant_name ?? "—"}</Td>
                <Td mono>{fmtMoney(l.annual_rent, l.currency)}/yr</Td>
                <Td mono>{ageDays != null ? `${ageDays}d` : "—"}</Td>
                <Td action>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/contracts/${l.contract_id}`); }}>
                    Open lease
                  </Button>
                </Td>
              </Row>
            );
          })}
        </Table>
      );

    case "in_signing":
      return (
        <Table headers={["Unit", "Building", "Tenant", "Rent", "Signatures", "Days in signing", ""]}>
          {cards.map((c) => {
            const l = c.lease!;
            const ageDays = daysSince(l.updated_at);
            return (
              <Row key={c.key} onClick={() => navigate(`/contracts/${l.contract_id}`)}>
                <Td primary>{c.unit.unit_number}</Td>
                <Td>{c.unit.building_name}</Td>
                <Td>{l.tenant_name ?? "—"}</Td>
                <Td mono>{fmtMoney(l.annual_rent, l.currency)}/yr</Td>
                <Td mono>
                  <span className={cn(l.signed_count < l.party_count && "text-amber-700")}>
                    {l.signed_count}/{l.party_count}
                  </span>
                </Td>
                <Td mono>{ageDays != null ? `${ageDays}d` : "—"}</Td>
                <Td action>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/contracts/${l.contract_id}`); }}>
                    <ListChecks className="h-3 w-3" /> Open
                  </Button>
                </Td>
              </Row>
            );
          })}
        </Table>
      );

    case "leased":
      return (
        <Table headers={["Unit", "Building", "Tenant", "Annual rent", "Start", "End", ""]}>
          {cards.map((c) => {
            const l = c.lease!;
            return (
              <Row key={c.key} onClick={() => navigate(`/contracts/${l.contract_id}`)}>
                <Td primary>{c.unit.unit_number}</Td>
                <Td>{c.unit.building_name}</Td>
                <Td>{l.tenant_name ?? "—"}</Td>
                <Td mono>{fmtMoney(l.annual_rent, l.currency)}</Td>
                <Td mono>{fmtDate(l.start_date)}</Td>
                <Td mono>{fmtDate(l.end_date)}</Td>
                <Td action>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/contracts/${l.contract_id}`); }}>View</Button>
                </Td>
              </Row>
            );
          })}
        </Table>
      );
  }
}

/* =========================================================
 * Reusable table primitives
 * ========================================================= */
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-left">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className={cn("px-4 py-2 label-eyebrow", i === headers.length - 1 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Row({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <tr onClick={onClick} className="border-t hairline hover:bg-muted/20 cursor-pointer">
      {children}
    </tr>
  );
}

function Td({
  children, primary, mono, action,
}: {
  children: React.ReactNode; primary?: boolean; mono?: boolean; action?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-2",
        primary && "text-architect font-medium",
        mono && "mono text-xs text-muted-foreground",
        !primary && !mono && !action && "text-muted-foreground",
        action && "text-right whitespace-nowrap",
      )}
    >
      {children}
    </td>
  );
}

function Pill({ stage, label }: { stage: LifecycleStage; label: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider font-medium",
      LIFECYCLE_STAGE_STYLES[stage],
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
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
 * Flat table view (all stages)
 * ========================================================= */
function FlatTable({
  byStage, onRowClick,
}: {
  byStage: Record<LifecycleStage, LifecycleCard[]>;
  onRowClick: (c: LifecycleCard) => void;
}) {
  const rows = useMemo(() => {
    const all: LifecycleCard[] = [];
    LIFECYCLE_STAGE_ORDER.forEach((s) => all.push(...byStage[s]));
    return all;
  }, [byStage]);

  return (
    <div className="border hairline rounded-sm bg-card overflow-hidden mb-10">
      <div className="flex items-center justify-between px-4 py-2.5 border-b hairline bg-muted/20">
        <div className="text-xs text-muted-foreground">{rows.length} item{rows.length === 1 ? "" : "s"}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="px-4 py-2 label-eyebrow text-left">Unit</th>
              <th className="px-4 py-2 label-eyebrow text-left">Building</th>
              <th className="px-4 py-2 label-eyebrow text-left">Stage</th>
              <th className="px-4 py-2 label-eyebrow text-left">Tenant</th>
              <th className="px-4 py-2 label-eyebrow text-left">Annual rent</th>
              <th className="px-4 py-2 label-eyebrow text-left">Listed / Started</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.key} onClick={() => onRowClick(c)} className="border-t hairline hover:bg-muted/20 cursor-pointer">
                <td className="px-4 py-2 text-architect">{c.unit.unit_number}</td>
                <td className="px-4 py-2 text-muted-foreground">{c.unit.building_name}</td>
                <td className="px-4 py-2"><Pill stage={c.stage} label={LIFECYCLE_STAGE_LABELS[c.stage]} /></td>
                <td className="px-4 py-2 text-muted-foreground">{c.lease?.tenant_name ?? "—"}</td>
                <td className="px-4 py-2 mono text-xs text-architect">
                  {c.lease?.annual_rent != null
                    ? fmtMoney(c.lease.annual_rent, c.lease.currency)
                    : c.unit.asking_rent != null ? `${fmtMoney(c.unit.asking_rent, c.unit.asking_rent_currency ?? "AED")} ask` : "—"}
                </td>
                <td className="px-4 py-2 mono text-xs text-muted-foreground">
                  {fmtDate(c.unit.listed_at ?? c.lease?.start_date ?? c.unit.vacant_since)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
