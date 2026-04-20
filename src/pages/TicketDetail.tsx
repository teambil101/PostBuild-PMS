import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Calendar, User as UserIcon, Activity, AlertTriangle, RefreshCw,
  DollarSign, RotateCcw, PlusCircle, Coins, Pencil, MoreHorizontal, Briefcase,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { TicketStatusPill, TicketPriorityPill, CostApprovalPill } from "@/components/tickets/TicketPills";
import {
  TICKET_TYPE_LABELS,
  TICKET_TYPE_CATEGORY,
  WAITING_ON_LABELS,
  isTicketOverdue,
  ticketOverdueDays,
  resolveTicketTargetLabel,
  targetPath,
  type TicketStatus,
  type TicketPriority,
} from "@/lib/tickets";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { PhotoGallery } from "@/components/attachments/PhotoGallery";
import { DocumentList } from "@/components/attachments/DocumentList";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { WorkflowSection } from "@/components/tickets/workflow/WorkflowSection";
import { WorkflowSummaryCard } from "@/components/tickets/workflow/WorkflowSummaryCard";
import { AddWorkflowDialog } from "@/components/tickets/workflow/AddWorkflowDialog";
import { ChangeWorkflowDialog } from "@/components/tickets/workflow/ChangeWorkflowDialog";
import { RemoveWorkflowDialog } from "@/components/tickets/workflow/RemoveWorkflowDialog";
import type { WorkflowKey } from "@/lib/workflows";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditTicketDialog } from "@/components/tickets/actions/EditTicketDialog";
import { ChangeStatusDialog } from "@/components/tickets/actions/ChangeStatusDialog";
import { AssignDialog } from "@/components/tickets/actions/AssignDialog";
import { CancelTicketDialog } from "@/components/tickets/actions/CancelTicketDialog";
import { DeleteTicketDialog } from "@/components/tickets/actions/DeleteTicketDialog";
import { CostApprovalBanner } from "@/components/tickets/actions/CostApprovalBanner";
import { AssignVendorDialog } from "@/components/vendors/AssignVendorDialog";
import { vendorDisplayName, parseSpecialties, SPECIALTY_LABELS } from "@/lib/vendors";
import { toast } from "sonner";

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string | null;
  ticket_type: string;
  priority: TicketPriority;
  status: TicketStatus;
  waiting_on: string | null;
  target_entity_type: string;
  target_entity_id: string;
  assignee_id: string | null;
  reporter_id: string | null;
  is_system_generated: boolean;
  due_date: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  currency: string;
  cost_approval_status: string | null;
  cost_approved_by_person_id: string | null;
  cost_approved_at: string | null;
  cost_approval_notes: string | null;
  created_by: string | null;
  created_at: string;
  workflow_key: string | null;
  current_stage_key: string | null;
  vendor_id: string | null;
}

interface EventRow {
  id: string;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  description: string | null;
  actor_id: string | null;
  created_at: string;
}

const TERMINAL: TicketStatus[] = ["closed", "cancelled"];

export default function TicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { canEdit, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [people, setPeople] = useState<Record<string, { first_name: string; last_name: string }>>({});
  const [targetLabel, setTargetLabel] = useState<string>("—");
  const [targetBuildingId, setTargetBuildingId] = useState<string | null>(null);
  const [selfPersonId, setSelfPersonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [notesCount, setNotesCount] = useState(0);
  const [photosCount, setPhotosCount] = useState(0);
  const [docsCount, setDocsCount] = useState(0);
  const [workflowRefresh, setWorkflowRefresh] = useState(0);

  // Dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addWfOpen, setAddWfOpen] = useState(false);
  const [changeWfOpen, setChangeWfOpen] = useState(false);
  const [removeWfOpen, setRemoveWfOpen] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);
  const [vendorInfo, setVendorInfo] = useState<{
    id: string;
    legal_name: string;
    display_name: string | null;
    vendor_number: string;
    is_preferred?: boolean;
    specialties?: unknown;
    status?: string;
  } | null>(null);
  const [stepStatusMap, setStepStatusMap] = useState<Record<string, "pending" | "complete" | "skipped">>({});

  useEffect(() => {
    if (!ticketId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [tRes, eRes, pRes, sRes] = await Promise.all([
        supabase.from("tickets").select("*").eq("id", ticketId).maybeSingle(),
        supabase.from("ticket_events").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: false }).limit(50),
        supabase.from("people").select("id, first_name, last_name, is_self"),
        supabase.from("app_settings").select("self_person_id").maybeSingle(),
      ]);
      if (cancelled) return;
      const t = tRes.data as Ticket | null;
      setTicket(t);
      setEvents((eRes.data ?? []) as EventRow[]);
      const pmap: Record<string, { first_name: string; last_name: string }> = {};
      for (const p of pRes.data ?? []) {
        pmap[(p as any).id] = { first_name: (p as any).first_name, last_name: (p as any).last_name };
      }
      setPeople(pmap);
      const sid = (sRes.data as any)?.self_person_id ?? (pRes.data ?? []).find((p: any) => p.is_self)?.id ?? null;
      setSelfPersonId(sid);

      if (t) {
        const lbl = await resolveTicketTargetLabel({ type: t.target_entity_type, id: t.target_entity_id });
        if (!cancelled) setTargetLabel(lbl);
        if (t.target_entity_type === "unit") {
          const { data: u } = await supabase.from("units").select("building_id").eq("id", t.target_entity_id).maybeSingle();
          if (!cancelled) setTargetBuildingId((u as any)?.building_id ?? null);
        }
        if (t.vendor_id) {
          const { data: v } = await supabase
            .from("vendors")
            .select("id, legal_name, display_name, vendor_number, is_preferred, specialties, status")
            .eq("id", t.vendor_id)
            .maybeSingle();
          if (!cancelled) setVendorInfo((v as any) ?? null);
        } else {
          if (!cancelled) setVendorInfo(null);
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [ticketId]);

  const overdue = ticket ? isTicketOverdue(ticket) : false;
  const overdueDays = ticket ? ticketOverdueDays(ticket) : 0;

  const tHref = useMemo(() => {
    if (!ticket) return null;
    return targetPath(
      { type: ticket.target_entity_type, id: ticket.target_entity_id },
      { unitBuildingId: targetBuildingId },
    );
  }, [ticket, targetBuildingId]);

  const personName = (id: string | null) => {
    if (!id) return null;
    const p = people[id];
    if (!p) return "Unknown";
    return `${p.first_name} ${p.last_name}`.trim();
  };

  const refetch = async () => {
    if (!ticketId) return;
    const [{ data: t }, { data: e }] = await Promise.all([
      supabase.from("tickets").select("*").eq("id", ticketId).maybeSingle(),
      supabase.from("ticket_events").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (t) setTicket(t as Ticket);
    setEvents((e ?? []) as EventRow[]);
    setWorkflowRefresh((n) => n + 1);
    // Refresh vendor info to mirror any vendor_id change.
    const vid = (t as any)?.vendor_id ?? null;
    if (vid) {
      const { data: v } = await supabase
        .from("vendors")
        .select("id, legal_name, display_name, vendor_number, is_preferred, specialties, status")
        .eq("id", vid)
        .maybeSingle();
      setVendorInfo((v as any) ?? null);
    } else {
      setVendorInfo(null);
    }
  };

  const handleReopen = async () => {
    if (!ticket) return;
    const { error } = await supabase.from("tickets").update({
      status: "open",
      resolved_at: null,
      closed_at: null,
      cancelled_at: null,
      cancelled_reason: null,
    }).eq("id", ticket.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Ticket reopened.");
    refetch();
  };

  if (loading) {
    return <div className="h-64 bg-muted/40 animate-pulse rounded-sm" />;
  }
  if (!ticket) {
    return (
      <EmptyState
        title="Ticket not found"
        description="It may have been deleted or the link is incorrect."
        action={<Button onClick={() => navigate("/tickets")}>Back to tickets</Button>}
      />
    );
  }

  const hasWorkflow = Boolean(ticket.workflow_key);
  const isTerminal = TERMINAL.includes(ticket.status);
  const showCostBanner = ticket.cost_approval_status === "pending" && !isTerminal;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mono text-[11px] uppercase tracking-wider text-muted-foreground">
        <Link to="/" className="hover:text-architect">Home</Link>
        <span>/</span>
        <Link to="/tickets" className="hover:text-architect">Tickets</Link>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="label-eyebrow text-true-taupe">
            Ticket · <span className="mono">{ticket.ticket_number}</span>
          </span>
          {ticket.is_system_generated && (
            <span className="text-[9px] uppercase tracking-wider italic text-muted-foreground border hairline rounded-sm px-1.5">
              Auto
            </span>
          )}
        </div>
        <h1 className="font-display text-4xl text-architect leading-tight">{ticket.subject}</h1>
        <div className="text-sm text-muted-foreground space-y-0.5">
          <div>
            <span className="text-architect">{TICKET_TYPE_LABELS[ticket.ticket_type as keyof typeof TICKET_TYPE_LABELS] ?? ticket.ticket_type}</span>
            <span className="mx-2">·</span>
            <span>Priority: {ticket.priority}</span>
          </div>
          <div>
            Target:{" "}
            {tHref ? (
              <Link to={tHref} className="text-architect underline decoration-gold/60 underline-offset-2 hover:decoration-gold">
                {targetLabel}
              </Link>
            ) : (
              <span className="text-architect">{targetLabel}</span>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 pb-6 border-b hairline">
        {canEdit && (
          <>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStatusOpen(true)} disabled={isTerminal}>
              Change status
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)} disabled={isTerminal}>
              {ticket.assignee_id ? "Reassign" : "Assign"}
            </Button>
            {!isTerminal && (
              <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
                Cancel ticket
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setVendorOpen(true)} disabled={isTerminal}>
              <Briefcase className="h-3.5 w-3.5" />
              {ticket.vendor_id ? "Change vendor" : "Assign vendor"}
            </Button>
            {isTerminal && (
              <Button variant="outline" size="sm" onClick={handleReopen}>
                <RotateCcw className="h-3.5 w-3.5" /> Reopen
              </Button>
            )}
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto px-2">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canEdit && (
              <>
                {hasWorkflow ? (
                  <>
                    <DropdownMenuItem onSelect={() => setChangeWfOpen(true)}>Change workflow</DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setRemoveWfOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      Remove workflow
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onSelect={() => setAddWfOpen(true)}>Add workflow</DropdownMenuItem>
                )}
                {isAdmin && <DropdownMenuSeparator />}
              </>
            )}
            {isAdmin && !ticket.is_system_generated && (
              <DropdownMenuItem
                onSelect={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                Delete ticket
              </DropdownMenuItem>
            )}
            {!canEdit && !isAdmin && (
              <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" onClick={() => navigate("/tickets")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      {/* Cost approval banner */}
      {showCostBanner && (
        <CostApprovalBanner
          ticketId={ticket.id}
          estimatedCost={ticket.estimated_cost}
          currency={ticket.currency}
          selfPersonId={selfPersonId}
          onDone={refetch}
        />
      )}

      {/* Summary cards */}
      <div className={cn("grid grid-cols-2 gap-3", hasWorkflow ? "lg:grid-cols-5" : "lg:grid-cols-6")}>
        <SummaryCard label="Status">
          <TicketStatusPill status={ticket.status} />
          {ticket.status === "awaiting" && ticket.waiting_on && (
            <div className="text-[11px] text-amber-700 mt-1.5">
              Waiting on {WAITING_ON_LABELS[ticket.waiting_on as keyof typeof WAITING_ON_LABELS]}
            </div>
          )}
          {overdue && (
            <div className="mt-2 -mx-4 -mb-4 px-4 py-1.5 bg-destructive/10 text-destructive text-[11px] border-t border-destructive/30">
              Overdue by {overdueDays} day{overdueDays === 1 ? "" : "s"}
            </div>
          )}
        </SummaryCard>
        {hasWorkflow ? (
          <SummaryCard label="Stage">
            <WorkflowSummaryCard ticketId={ticket.id} refreshKey={workflowRefresh} />
          </SummaryCard>
        ) : null}
        <SummaryCard label="Priority">
          <TicketPriorityPill priority={ticket.priority} />
        </SummaryCard>
        <SummaryCard label="Assignee">
          {ticket.assignee_id ? (
            <div className="text-sm text-architect">{personName(ticket.assignee_id)}</div>
          ) : (
            <div className="text-sm text-muted-foreground italic">Unassigned</div>
          )}
        </SummaryCard>
        <SummaryCard label="Due date">
          {ticket.due_date ? (
            <div className={cn("text-sm", overdue ? "text-destructive font-medium" : "text-architect")}>
              {format(new Date(ticket.due_date), "MMM d, yyyy")}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">No due date</div>
          )}
          <div className="text-[11px] text-muted-foreground mt-1">
            Created {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
          </div>
        </SummaryCard>
        <SummaryCard label="Cost">
          {!ticket.cost_approval_status || ticket.cost_approval_status === "not_required" ? (
            ticket.estimated_cost == null && ticket.actual_cost == null ? (
              <div className="text-sm text-muted-foreground italic">No cost data</div>
            ) : (
              <div className="text-sm text-architect">
                {ticket.actual_cost != null ? (
                  <>{ticket.currency} {Number(ticket.actual_cost).toLocaleString()}</>
                ) : (
                  <>Est. {ticket.currency} {Number(ticket.estimated_cost).toLocaleString()}</>
                )}
              </div>
            )
          ) : (
            <>
              <CostApprovalPill status={ticket.cost_approval_status} />
              {(ticket.estimated_cost != null || ticket.actual_cost != null) && (
                <div className="text-[11px] text-muted-foreground mt-1">
                  {ticket.actual_cost != null
                    ? `${ticket.currency} ${Number(ticket.actual_cost).toLocaleString()}`
                    : `Est. ${ticket.currency} ${Number(ticket.estimated_cost).toLocaleString()}`}
                </div>
              )}
              {ticket.cost_approval_status === "approved" && ticket.cost_approved_at && (
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  by {personName(ticket.cost_approved_by_person_id) ?? "Unknown"} on {format(new Date(ticket.cost_approved_at), "MMM d, yyyy")}
                </div>
              )}
            </>
          )}
        </SummaryCard>
      </div>

      {hasWorkflow && ticket.workflow_key && (
        <WorkflowSection
          ticketId={ticket.id}
          workflowKey={ticket.workflow_key as WorkflowKey}
          currentStageKey={ticket.current_stage_key}
          refreshKey={workflowRefresh}
          onChanged={() => {
            setWorkflowRefresh((n) => n + 1);
            refetch();
          }}
          onStepStatusMap={setStepStatusMap}
          personName={personName}
        />
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="comments">Comments {notesCount > 0 && <span className="ml-1 text-muted-foreground">({notesCount})</span>}</TabsTrigger>
          <TabsTrigger value="attachments">
            Attachments {(photosCount + docsCount) > 0 && <span className="ml-1 text-muted-foreground">({photosCount + docsCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 pt-6">
          {ticket.description && (
            <Section title="Description">
              <p className="text-sm text-architect whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
            </Section>
          )}

          <Section title="Type & priority">
            <div className="text-sm">
              <div><span className="text-muted-foreground">Category:</span> {TICKET_TYPE_CATEGORY(ticket.ticket_type)}</div>
              <div><span className="text-muted-foreground">Type:</span> {TICKET_TYPE_LABELS[ticket.ticket_type as keyof typeof TICKET_TYPE_LABELS] ?? ticket.ticket_type}</div>
              <div><span className="text-muted-foreground">Priority:</span> {ticket.priority}</div>
            </div>
          </Section>

          <Section title="Reporter">
            <div className="text-sm text-architect">{personName(ticket.reporter_id) ?? <span className="text-muted-foreground italic">Unknown</span>}</div>
          </Section>

          {(ticket.estimated_cost != null || ticket.actual_cost != null || ticket.cost_approval_status) && (
            <Section title="Cost">
              <div className="text-sm space-y-1">
                <div><span className="text-muted-foreground">Estimated:</span> {ticket.estimated_cost != null ? `${ticket.currency} ${Number(ticket.estimated_cost).toLocaleString()}` : "—"}</div>
                <div><span className="text-muted-foreground">Actual:</span> {ticket.actual_cost != null ? `${ticket.currency} ${Number(ticket.actual_cost).toLocaleString()}` : "Not recorded yet"}</div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Approval:</span>
                  {ticket.cost_approval_status ? <CostApprovalPill status={ticket.cost_approval_status} /> : "—"}
                  {ticket.cost_approval_status === "approved" && ticket.cost_approved_at && (
                    <span className="text-[11px] text-muted-foreground">
                      by {personName(ticket.cost_approved_by_person_id) ?? "Unknown"} on {format(new Date(ticket.cost_approved_at), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
                {ticket.cost_approval_notes && (
                  <div className="text-xs text-muted-foreground italic">"{ticket.cost_approval_notes}"</div>
                )}
              </div>
            </Section>
          )}

          <Section title="Dates">
            <div className="text-sm space-y-1">
              <div><span className="text-muted-foreground">Created:</span> {format(new Date(ticket.created_at), "PPP")}</div>
              <div><span className="text-muted-foreground">Due:</span> {ticket.due_date ? format(new Date(ticket.due_date), "PPP") : "No due date set"}</div>
              {ticket.resolved_at && <div><span className="text-muted-foreground">Resolved:</span> {format(new Date(ticket.resolved_at), "PPP p")}</div>}
              {ticket.closed_at && <div><span className="text-muted-foreground">Closed:</span> {format(new Date(ticket.closed_at), "PPP p")}</div>}
              {ticket.cancelled_at && (
                <div>
                  <span className="text-muted-foreground">Cancelled:</span> {format(new Date(ticket.cancelled_at), "PPP p")}
                  {ticket.cancelled_reason && <span className="text-muted-foreground italic"> — {ticket.cancelled_reason}</span>}
                </div>
              )}
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="comments" className="pt-6">
          <NotesPanel
            entityType="ticket"
            entityId={ticket.id}
            onCountChange={setNotesCount}
          />
        </TabsContent>

        <TabsContent value="attachments" className="pt-6 space-y-8">
          <div>
            <div className="label-eyebrow mb-3">Photos</div>
            <PhotoGallery entityType="ticket" entityId={ticket.id} editable={canEdit} onCountChange={setPhotosCount} />
          </div>
          <div>
            <div className="label-eyebrow mb-3">Documents</div>
            <DocumentList entityType="ticket" entityId={ticket.id} editable={canEdit} onCountChange={setDocsCount} />
          </div>
        </TabsContent>

        <TabsContent value="history" className="pt-6">
          {events.length === 0 ? (
            <EmptyState title="No events yet" description="Ticket activity will appear here." />
          ) : (
            <ul className="space-y-3">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-3 border hairline rounded-sm bg-card p-3">
                  <span className="h-7 w-7 rounded-sm bg-muted/50 flex items-center justify-center text-true-taupe shrink-0">
                    {iconFor(e.event_type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-architect">{describeEvent(e, personName)}</div>
                    <div className="text-[11px] text-muted-foreground mono mt-0.5" title={format(new Date(e.created_at), "PPP p")}>
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                      {" · "}
                      {e.actor_id ? (personName(e.actor_id) ?? "User") : "System"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {/* Action dialogs */}
      {canEdit && (
        <>
          <EditTicketDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            ticket={ticket}
            onDone={refetch}
          />
          <ChangeStatusDialog
            open={statusOpen}
            onOpenChange={setStatusOpen}
            ticketId={ticket.id}
            currentStatus={ticket.status}
            currentWaitingOn={ticket.waiting_on}
            onDone={refetch}
          />
          <AssignDialog
            open={assignOpen}
            onOpenChange={setAssignOpen}
            ticketId={ticket.id}
            currentAssigneeId={ticket.assignee_id}
            onDone={refetch}
          />
          <CancelTicketDialog
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            ticketId={ticket.id}
            onDone={refetch}
          />
        </>
      )}
      {isAdmin && (
        <DeleteTicketDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          ticketId={ticket.id}
          ticketNumber={ticket.ticket_number}
          onDone={() => navigate("/tickets")}
        />
      )}

      {/* Workflow management dialogs */}
      {!hasWorkflow && (
        <AddWorkflowDialog
          open={addWfOpen}
          onOpenChange={setAddWfOpen}
          ticketId={ticket.id}
          onDone={refetch}
        />
      )}
      {hasWorkflow && ticket.workflow_key && (
        <>
          <ChangeWorkflowDialog
            open={changeWfOpen}
            onOpenChange={setChangeWfOpen}
            ticketId={ticket.id}
            currentWorkflowKey={ticket.workflow_key as WorkflowKey}
            currentStepStatusMap={stepStatusMap}
            onDone={refetch}
            onSwitchToRemove={() => setRemoveWfOpen(true)}
          />
          <RemoveWorkflowDialog
            open={removeWfOpen}
            onOpenChange={setRemoveWfOpen}
            ticketId={ticket.id}
            workflowKey={ticket.workflow_key as WorkflowKey}
            onDone={refetch}
          />
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border hairline rounded-sm bg-card p-5">
      <div className="label-eyebrow mb-3">{title}</div>
      {children}
    </div>
  );
}

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border hairline rounded-sm bg-card p-4 overflow-hidden">
      <div className="label-eyebrow mb-2">{label}</div>
      {children}
    </div>
  );
}

function iconFor(type: string) {
  const cls = "h-3.5 w-3.5";
  switch (type) {
    case "created": return <PlusCircle className={cls} />;
    case "status_changed": return <Activity className={cls} />;
    case "priority_changed": return <AlertTriangle className={cls} />;
    case "assignee_changed":
    case "reporter_changed": return <UserIcon className={cls} />;
    case "target_changed": return <RefreshCw className={cls} />;
    case "due_date_changed": return <Calendar className={cls} />;
    case "cost_estimated":
    case "cost_actual_recorded":
    case "cost_approval_requested":
    case "cost_approval_approved":
    case "cost_approval_rejected": return <Coins className={cls} />;
    case "reopened": return <RotateCcw className={cls} />;
    default: return <DollarSign className={cls} />;
  }
}

function describeEvent(e: EventRow, personName: (id: string | null) => string | null): string {
  const from = e.from_value ?? "—";
  const to = e.to_value ?? "—";
  switch (e.event_type) {
    case "created": return `Created ticket with status ${to}`;
    case "status_changed": return `Changed status: ${from} → ${to}`;
    case "priority_changed": return `Changed priority: ${from} → ${to}`;
    case "assignee_changed": {
      const toName = e.to_value ? personName(e.to_value) ?? "Unknown" : "Unassigned";
      return e.from_value ? `Reassigned to ${toName}` : `Assigned to ${toName}`;
    }
    case "reporter_changed": {
      const toName = e.to_value ? personName(e.to_value) ?? "Unknown" : "Unknown";
      return `Reporter set to ${toName}`;
    }
    case "target_changed": return `Updated target: ${from} → ${to}`;
    case "due_date_changed": return `Due date: ${from} → ${to}`;
    case "cost_estimated": return `Estimated cost set: ${to}`;
    case "cost_actual_recorded": return `Actual cost recorded: ${to}`;
    case "cost_approval_requested": return `Cost approval requested`;
    case "cost_approval_approved": return `Cost approval approved`;
    case "cost_approval_rejected": return `Cost approval rejected`;
    case "reopened": return `Reopened`;
    case "note": return e.description ?? "Note added";
    default: return e.description ?? e.event_type;
  }
}
