import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor,
  useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { ArrowDown, ArrowUp, CheckCircle2, PauseCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  LEAD_STATUS_LABELS, getStageAgingDays, isStageStuck, getDaysToClose,
  type LeadRow, type LeadStatus,
} from "@/lib/leads";
import { MarkLostDialog } from "@/components/leads/dialogs/MarkLostDialog";
import { MarkContractSignedDialog } from "@/components/leads/dialogs/MarkContractSignedDialog";
import { ReopenLostDialog } from "@/components/leads/dialogs/ReopenLostDialog";

type PersonLite = { id: string; first_name: string; last_name: string; company: string | null };

interface Props {
  leads: LeadRow[];
  people: Record<string, PersonLite>;
  contractsByLead: Record<string, { id: string; contract_number: string } | undefined>;
  showOnHold: boolean;
  onChanged: () => void;
}

const COLUMNS: LeadStatus[] = [
  "new", "qualified", "discovery", "proposal", "negotiating", "contract_signed", "lost",
];

type SortMode = "fresh" | "close";

export function LeadsKanban({ leads, people, contractsByLead, showOnHold, onChanged }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sortByCol, setSortByCol] = useState<Record<LeadStatus, SortMode>>(
    () => Object.fromEntries(COLUMNS.map((c) => [c, "fresh"])) as Record<LeadStatus, SortMode>,
  );

  const [pendingLost, setPendingLost] = useState<LeadRow | null>(null);
  const [pendingSign, setPendingSign] = useState<LeadRow | null>(null);
  const [pendingReopen, setPendingReopen] = useState<{ lead: LeadRow; target: LeadStatus } | null>(null);

  const grouped = useMemo(() => {
    const map: Record<LeadStatus, LeadRow[]> = Object.fromEntries(
      COLUMNS.map((c) => [c, [] as LeadRow[]]),
    ) as Record<LeadStatus, LeadRow[]>;

    for (const l of leads) {
      if (l.status === "on_hold") {
        if (!showOnHold) continue;
        const col = (l.pre_hold_status ?? "new") as LeadStatus;
        if (map[col]) map[col].push(l);
        continue;
      }
      if (map[l.status]) map[l.status].push(l);
    }

    for (const c of COLUMNS) {
      const mode = sortByCol[c];
      map[c].sort((a, b) => {
        if (mode === "close") {
          const av = a.target_close_date ?? "9999-12-31";
          const bv = b.target_close_date ?? "9999-12-31";
          return av.localeCompare(bv);
        }
        return new Date(b.stage_entered_at).getTime() - new Date(a.stage_entered_at).getTime();
      });
    }
    return map;
  }, [leads, showOnHold, sortByCol]);

  const activeLead = activeId ? leads.find((l) => l.id === activeId) ?? null : null;

  const handleStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleEnd = async (e: DragEndEvent) => {
    const id = String(e.active.id);
    const target = e.over?.id ? (String(e.over.id) as LeadStatus) : null;
    setActiveId(null);
    if (!target) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;

    const fromStatus = lead.status;
    if (fromStatus === target) return;
    if (fromStatus === "on_hold" && lead.pre_hold_status === target) return;

    if (fromStatus === "contract_signed" && target !== "contract_signed") {
      toast.error(
        "Contract Signed leads cannot be reopened. If the contract was terminated, handle it on the agreement itself — the lead stays as a historical win record.",
      );
      return;
    }

    if (target === "contract_signed") { setPendingSign(lead); return; }
    if (target === "lost") { setPendingLost(lead); return; }
    if (fromStatus === "lost") { setPendingReopen({ lead, target }); return; }

    if (fromStatus === "on_hold") {
      const { error } = await supabase
        .from("leads")
        .update({ status: target, hold_since: null, pre_hold_status: null })
        .eq("id", lead.id);
      if (error) { toast.error(error.message); return; }
      toast.success(`Resumed to ${LEAD_STATUS_LABELS[target]}.`);
      onChanged();
      return;
    }

    const { error } = await supabase.from("leads").update({ status: target }).eq("id", lead.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Stage updated.");
    onChanged();
  };

  const flipSort = (col: LeadStatus) => {
    setSortByCol((s) => ({ ...s, [col]: s[col] === "fresh" ? "close" : "fresh" }));
  };

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleStart} onDragEnd={handleEnd}>
        <div className="flex gap-3 overflow-x-auto pb-3">
          {COLUMNS.map((col) => (
            <Column
              key={col}
              status={col}
              leads={grouped[col]}
              people={people}
              contractsByLead={contractsByLead}
              sortMode={sortByCol[col]}
              onFlipSort={() => flipSort(col)}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeLead && (
            <div className="rotate-1 opacity-90 w-[260px]">
              <LeadCard
                lead={activeLead}
                people={people}
                contractsByLead={contractsByLead}
                draggingPreview
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {pendingLost && (
        <MarkLostDialog
          open={!!pendingLost}
          onOpenChange={(v) => !v && setPendingLost(null)}
          lead={pendingLost}
          onSaved={() => { setPendingLost(null); onChanged(); }}
        />
      )}
      {pendingSign && (
        <MarkContractSignedDialog
          open={!!pendingSign}
          onOpenChange={(v) => !v && setPendingSign(null)}
          lead={pendingSign}
          onConverted={() => { setPendingSign(null); onChanged(); }}
          onCancel={() => setPendingSign(null)}
        />
      )}
      {pendingReopen && (
        <ReopenLostDialog
          open={!!pendingReopen}
          onOpenChange={(v) => !v && setPendingReopen(null)}
          lead={pendingReopen.lead}
          targetStatus={pendingReopen.target}
          onReopened={() => { setPendingReopen(null); onChanged(); }}
          onCancel={() => setPendingReopen(null)}
        />
      )}
    </>
  );
}

function Column({
  status, leads, people, contractsByLead, sortMode, onFlipSort,
}: {
  status: LeadStatus;
  leads: LeadRow[];
  people: Record<string, PersonLite>;
  contractsByLead: Record<string, { id: string; contract_number: string } | undefined>;
  sortMode: SortMode;
  onFlipSort: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "shrink-0 w-[280px] rounded-sm border hairline bg-warm-stone/20 flex flex-col",
        isOver && "ring-2 ring-gold/50 bg-gold/[0.04]",
        status === "lost" && isOver && "ring-destructive/40 bg-destructive/[0.05]",
        status === "contract_signed" && isOver && "ring-status-occupied/40 bg-status-occupied/[0.05]",
      )}
    >
      <div className="px-3 py-2 border-b hairline flex items-center justify-between sticky top-0 bg-warm-stone/30 backdrop-blur-sm rounded-t-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className="label-eyebrow text-architect truncate">{LEAD_STATUS_LABELS[status]}</span>
          <span className="text-[10px] mono px-1.5 py-0.5 bg-architect/10 text-architect rounded-sm">
            {leads.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onFlipSort}
          title={sortMode === "fresh" ? "Sort by target close date ↑" : "Sort by stage age ↓"}
          className="text-muted-foreground hover:text-architect"
        >
          {sortMode === "fresh"
            ? <ArrowDown className="h-3 w-3" />
            : <ArrowUp className="h-3 w-3" />}
        </button>
      </div>

      <div className="flex-1 p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-340px)] overflow-y-auto">
        {leads.length === 0 ? (
          <div className="text-[11px] text-muted-foreground/60 text-center py-6">No leads</div>
        ) : (
          leads.map((l) => (
            <DraggableCard key={l.id} lead={l} people={people} contractsByLead={contractsByLead} />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  lead, people, contractsByLead,
}: {
  lead: LeadRow;
  people: Record<string, PersonLite>;
  contractsByLead: Record<string, { id: string; contract_number: string } | undefined>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ touchAction: "none" }}
      className={cn(isDragging && "opacity-30")}
    >
      <LeadCard lead={lead} people={people} contractsByLead={contractsByLead} />
    </div>
  );
}

function LeadCard({
  lead, people, contractsByLead, draggingPreview,
}: {
  lead: LeadRow;
  people: Record<string, PersonLite>;
  contractsByLead: Record<string, { id: string; contract_number: string } | undefined>;
  draggingPreview?: boolean;
}) {
  const contact = people[lead.primary_contact_id];
  const company = lead.company_id ? people[lead.company_id] : null;
  const assignee = lead.assignee_id ? people[lead.assignee_id] : null;
  const days = getStageAgingDays(lead);
  const stuck = isStageStuck(lead, 14);
  const dToClose = getDaysToClose(lead.target_close_date);
  const closeOverdue = dToClose != null && dToClose < 0;
  const onHold = lead.status === "on_hold";
  const isWon = lead.status === "contract_signed";
  const isLost = lead.status === "lost";
  const wonContract = contractsByLead[lead.id];

  const ageColor =
    isWon || isLost
      ? "text-muted-foreground"
      : stuck
        ? "text-destructive"
        : days >= 7 && (lead.status === "proposal" || lead.status === "negotiating")
          ? "text-amber-700"
          : days < 7
            ? "text-status-occupied"
            : "text-muted-foreground";

  return (
    <div
      className={cn(
        "relative rounded-sm border bg-card p-2.5 text-xs transition-shadow group border-l-2",
        stuck && !isWon && !isLost ? "border-l-amber-500/70" : "border-l-warm-stone",
        isWon && "border-l-status-occupied bg-status-occupied/[0.04]",
        isLost && "border-l-destructive opacity-70",
        onHold && "opacity-50",
        !draggingPreview && "hover:shadow-sm cursor-grab active:cursor-grabbing",
      )}
    >
      {onHold && (<PauseCircle className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-amber-700" />)}
      {isWon && (<CheckCircle2 className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-status-occupied" />)}

      <div className="pr-5">
        <Link
          to={`/leads/${lead.id}`}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="font-medium text-architect hover:text-gold-deep block truncate"
        >
          {contact ? `${contact.first_name} ${contact.last_name}` : "Missing contact"}
        </Link>
        {(company?.company || contact?.company) && (
          <div className="text-[10.5px] text-muted-foreground truncate">
            {company?.company || contact?.company}
          </div>
        )}
      </div>

      <div className="mt-1 text-[11px] text-architect">
        {lead.estimated_annual_fee != null ? (
          <span>
            {lead.currency} {Number(lead.estimated_annual_fee).toLocaleString()}
            <span className="text-muted-foreground">/yr</span>
            {lead.probability_percent != null && (
              <span className="text-muted-foreground"> · {lead.probability_percent}%</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10.5px]">
        <div className="flex items-center gap-1.5 min-w-0">
          {assignee ? (
            <span
              className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-architect/10 text-architect text-[9px] font-medium"
              title={`${assignee.first_name} ${assignee.last_name}`}
            >
              {(assignee.first_name?.[0] ?? "") + (assignee.last_name?.[0] ?? "")}
            </span>
          ) : (
            <span className="text-muted-foreground/70 italic">Unassigned</span>
          )}
          <span className={ageColor}>{days}d</span>
        </div>
        {lead.target_close_date && (
          <span className={cn(closeOverdue && !isWon && !isLost ? "text-destructive" : "text-muted-foreground")}>
            → {format(new Date(lead.target_close_date + "T00:00:00"), "MMM d")}
          </span>
        )}
      </div>

      {isWon && wonContract && (
        <div className="mt-1.5 pt-1.5 border-t hairline text-[10px] mono text-status-occupied truncate">
          {wonContract.contract_number}
        </div>
      )}
      {isLost && lead.lost_reason && (
        <div className="mt-1.5 pt-1.5 border-t hairline text-[10px] uppercase tracking-wider text-destructive/80 truncate">
          {lead.lost_reason.replaceAll("_", " ")}
        </div>
      )}

      <div className="mt-1 text-[9.5px] mono text-muted-foreground/70 text-right">
        {lead.lead_number}
      </div>
    </div>
  );
}
