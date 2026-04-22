import { type ReactNode } from "react";
import { Tag, ListChecks, ExternalLink, ChevronRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatEnumLabel } from "@/lib/format";
import {
  LIFECYCLE_STAGE_ORDER,
  LIFECYCLE_STAGE_SHORT,
  LIFECYCLE_STAGE_LABELS,
  LIFECYCLE_STAGE_STYLES,
  daysBetween,
  type LifecycleStage,
  type LifecycleCard,
} from "@/lib/lifecycle";

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

interface Props {
  byStage: Record<LifecycleStage, LifecycleCard[]>;
  highlightStage: LifecycleStage | null;
  laneRefSet: (stage: LifecycleStage) => (el: HTMLDivElement | null) => void;
  onMarkListed: (c: LifecycleCard) => void;
  onUnlist: (c: LifecycleCard) => void;
  navigate: (p: string) => void;
}

export function LifecycleKanban({
  byStage, highlightStage, laneRefSet, onMarkListed, onUnlist, navigate,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4 pb-8">
      {LIFECYCLE_STAGE_ORDER.map((stage) => (
        <Lane
          key={stage}
          stage={stage}
          cards={byStage[stage]}
          highlight={highlightStage === stage}
          refSet={laneRefSet(stage)}
          onMarkListed={onMarkListed}
          onUnlist={onUnlist}
          navigate={navigate}
        />
      ))}
    </div>
  );
}

function Lane({
  stage, cards, highlight, refSet, onMarkListed, onUnlist, navigate,
}: {
  stage: LifecycleStage;
  cards: LifecycleCard[];
  highlight: boolean;
  refSet: (el: HTMLDivElement | null) => void;
  onMarkListed: (c: LifecycleCard) => void;
  onUnlist: (c: LifecycleCard) => void;
  navigate: (p: string) => void;
}) {
  const isLeased = stage === "leased";
  return (
    <div
      ref={refSet}
      className={cn(
        "flex flex-col border hairline rounded-sm bg-muted/10 min-h-[300px] transition-shadow",
        highlight && "ring-2 ring-gold shadow-md",
        isLeased && "bg-muted/20",
      )}
    >
      {/* Lane header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b hairline bg-card rounded-t-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("h-2 w-2 rounded-full shrink-0", swatchFor(stage))} />
          <span className="label-eyebrow text-architect text-[10px] truncate">{LIFECYCLE_STAGE_SHORT[stage]}</span>
          <span className={cn(
            "mono text-[10px] px-1.5 py-0.5 rounded-sm border bg-background shrink-0",
            LIFECYCLE_STAGE_STYLES[stage],
          )}>
            {cards.length}
          </span>
        </div>
        {isLeased && (
          <button
            onClick={() => navigate("/contracts?type=lease&status=active")}
            className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-architect inline-flex items-center gap-1"
            title="View all active leases"
          >
            All <ExternalLink className="h-2.5 w-2.5" />
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[70vh]">
        {cards.length === 0 ? (
          <div className="px-3 py-10 text-[11px] text-muted-foreground italic text-center">
            {emptyFor(stage)}
          </div>
        ) : (
          cards.map((c) => (
            <UnitCard
              key={c.key}
              card={c}
              stage={stage}
              onMarkListed={() => onMarkListed(c)}
              onUnlist={() => onUnlist(c)}
              navigate={navigate}
            />
          ))
        )}
      </div>
    </div>
  );
}

function UnitCard({
  card, stage, onMarkListed, onUnlist, navigate,
}: {
  card: LifecycleCard;
  stage: LifecycleStage;
  onMarkListed: () => void;
  onUnlist: () => void;
  navigate: (p: string) => void;
}) {
  const u = card.unit;
  const l = card.lease;

  const goToUnit = () => navigate(`/properties/${u.building_id}/units/${u.id}`);
  const goToLease = () => l && navigate(`/contracts/${l.contract_id}`);
  const primaryClick = l ? goToLease : goToUnit;

  return (
    <div
      onClick={primaryClick}
      className="group bg-card border hairline rounded-sm p-2.5 cursor-pointer hover:shadow-sm hover:border-architect/30 transition-all"
    >
      {/* Top row: unit + building */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <div className="text-architect font-medium text-sm leading-tight truncate">{u.unit_number}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
            <Building2 className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{u.building_name}</span>
          </div>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
      </div>

      {/* Stage-specific body */}
      <CardBody card={card} stage={stage} />

      {/* Stage-specific action */}
      <CardAction
        card={card}
        stage={stage}
        onMarkListed={onMarkListed}
        onUnlist={onUnlist}
        goToUnit={goToUnit}
        goToLease={goToLease}
      />
    </div>
  );
}

function CardBody({ card, stage }: { card: LifecycleCard; stage: LifecycleStage }) {
  const u = card.unit;
  const l = card.lease;

  switch (stage) {
    case "not_ready":
      return (
        <div className="space-y-1">
          <Row label="Status" value={formatEnumLabel(u.status)} />
          <Row label="Since" value={fmtDate(u.vacant_since)} mono />
        </div>
      );
    case "ready_unlisted": {
      const days = daysSince(u.vacant_since);
      return (
        <div className="space-y-1">
          <Row label="Type" value={`${formatEnumLabel(u.unit_type)}${u.floor != null ? ` · F${u.floor}` : ""}`} />
          <Row
            label="Vacant"
            value={days != null ? `${days}d` : "—"}
            mono
            tone={days != null && days > 30 ? "warn" : undefined}
          />
          <Row
            label="Mgmt"
            value={u.has_mgmt_agreement ? "Yes" : "No agreement"}
            tone={u.has_mgmt_agreement ? undefined : "warn"}
          />
        </div>
      );
    }
    case "listed": {
      const days = daysSince(u.listed_at);
      return (
        <div className="space-y-1">
          <Row label="Asking" value={fmtMoney(u.asking_rent, u.asking_rent_currency ?? "AED")} mono />
          <Row label="Listed" value={fmtDate(u.listed_at)} mono />
          <Row
            label="Days listed"
            value={days != null ? `${days}d` : "—"}
            mono
            tone={days != null && days > 30 ? "warn" : undefined}
          />
        </div>
      );
    }
    case "offer_pending": {
      const ageDays = daysSince(l?.created_at);
      return (
        <div className="space-y-1">
          <Row label="Tenant" value={l?.tenant_name ?? "—"} />
          <Row label="Rent" value={`${fmtMoney(l?.annual_rent, l?.currency)}/yr`} mono />
          <Row
            label="Awaiting"
            value={ageDays != null ? `${ageDays}d` : "—"}
            mono
            tone={ageDays != null && ageDays > 7 ? "warn" : undefined}
          />
        </div>
      );
    }
    case "in_signing": {
      const ageDays = daysSince(l?.updated_at);
      const incomplete = (l?.signed_count ?? 0) < (l?.party_count ?? 0);
      return (
        <div className="space-y-1">
          <Row label="Tenant" value={l?.tenant_name ?? "—"} />
          <Row label="Rent" value={`${fmtMoney(l?.annual_rent, l?.currency)}/yr`} mono />
          <Row
            label="Signatures"
            value={`${l?.signed_count ?? 0}/${l?.party_count ?? 0}`}
            mono
            tone={incomplete ? "warn" : undefined}
          />
          <Row
            label="In signing"
            value={ageDays != null ? `${ageDays}d` : "—"}
            mono
            tone={ageDays != null && ageDays > 14 ? "warn" : undefined}
          />
        </div>
      );
    }
    case "leased":
      return (
        <div className="space-y-1">
          <Row label="Tenant" value={l?.tenant_name ?? "—"} />
          <Row label="Rent" value={fmtMoney(l?.annual_rent, l?.currency)} mono />
          <Row label="Start" value={fmtDate(l?.start_date)} mono />
          <Row label="End" value={fmtDate(l?.end_date)} mono />
        </div>
      );
  }
}

function CardAction({
  card, stage, onMarkListed, onUnlist, goToUnit, goToLease,
}: {
  card: LifecycleCard;
  stage: LifecycleStage;
  onMarkListed: () => void;
  onUnlist: () => void;
  goToUnit: () => void;
  goToLease: () => void;
}) {
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };

  const content: ReactNode = (() => {
    switch (stage) {
      case "not_ready":
        return (
          <Button variant="ghost" size="sm" className="h-7 w-full" onClick={stop(goToUnit)}>
            View unit
          </Button>
        );
      case "ready_unlisted":
        return (
          <Button variant="gold" size="sm" className="h-7 w-full" onClick={stop(onMarkListed)}>
            <Tag className="h-3 w-3" /> Mark listed
          </Button>
        );
      case "listed":
        return (
          <Button variant="ghost" size="sm" className="h-7 w-full" onClick={stop(onUnlist)}>
            Unlist
          </Button>
        );
      case "offer_pending":
        return (
          <Button variant="ghost" size="sm" className="h-7 w-full" onClick={stop(goToLease)}>
            Open lease
          </Button>
        );
      case "in_signing":
        return (
          <Button variant="ghost" size="sm" className="h-7 w-full" onClick={stop(goToLease)}>
            <ListChecks className="h-3 w-3" /> Open
          </Button>
        );
      case "leased":
        return (
          <Button variant="ghost" size="sm" className="h-7 w-full" onClick={stop(goToLease)}>
            View lease
          </Button>
        );
    }
  })();

  return <div className="mt-2 pt-2 border-t hairline">{content}</div>;
}

function Row({
  label, value, mono, tone,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  tone?: "warn";
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground uppercase tracking-wider text-[9px]">{label}</span>
      <span
        className={cn(
          "text-architect truncate text-right",
          mono && "mono text-[10.5px]",
          tone === "warn" && "text-amber-700",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function emptyFor(stage: LifecycleStage): string {
  switch (stage) {
    case "not_ready": return "All units ready.";
    case "ready_unlisted": return "Every ready unit is listed.";
    case "listed": return "No active listings.";
    case "offer_pending": return "No offers pending.";
    case "in_signing": return "Nothing in signing.";
    case "leased": return "No leases activated in the last 30 days.";
  }
}

function swatchFor(stage: LifecycleStage): string {
  switch (stage) {
    case "not_ready": return "bg-status-maintenance";
    case "ready_unlisted": return "bg-true-taupe";
    case "listed": return "bg-status-vacant";
    case "offer_pending": return "bg-amber-500";
    case "in_signing": return "bg-amber-600";
    case "leased": return "bg-status-occupied";
  }
}

/* Helpful re-exports for consumers needing labels */
export const LANE_LABELS = LIFECYCLE_STAGE_LABELS;