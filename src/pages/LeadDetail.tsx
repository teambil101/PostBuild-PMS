import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft, Pencil, MoreHorizontal, Activity, PauseCircle, PlayCircle,
  XCircle, CheckCircle2, Trash2, User, Building2, Phone, Calendar, TrendingUp,
  AlertTriangle, Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatCurrency, formatEnumLabel, initials } from "@/lib/format";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { DocumentList } from "@/components/attachments/DocumentList";
import { NewLeadDialog } from "@/components/leads/NewLeadDialog";
import { ChangeStageDialog } from "@/components/leads/dialogs/ChangeStageDialog";
import { ReassignLeadDialog } from "@/components/leads/dialogs/ReassignLeadDialog";
import { MarkLostDialog } from "@/components/leads/dialogs/MarkLostDialog";
import { PutOnHoldDialog } from "@/components/leads/dialogs/PutOnHoldDialog";
import { ResumeFromHoldDialog } from "@/components/leads/dialogs/ResumeFromHoldDialog";
import { DeleteLeadDialog } from "@/components/leads/dialogs/DeleteLeadDialog";
import { MarkContractSignedDialog } from "@/components/leads/dialogs/MarkContractSignedDialog";
import { LeadHistoryTab } from "@/components/leads/tabs/LeadHistoryTab";
import {
  LEAD_STATUS_LABELS, LEAD_STATUS_STYLES, LEAD_SOURCE_LABELS,
  LEAD_LOST_REASON_LABELS,
  TERMINAL_STATUSES,
  getStageAgingDays, isStageStuck, getDaysToClose, getWeightedValue,
  type LeadRow, type LeadStatus,
} from "@/lib/leads";
import { FEE_MODEL_LABELS, SCOPE_LABELS, type ScopeService } from "@/lib/contracts";

type PersonLite = {
  id: string; first_name: string; last_name: string;
  company: string | null; phone: string | null; email: string | null;
};

export default function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { canEdit, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [lead, setLead] = useState<LeadRow | null>(null);
  const [people, setPeople] = useState<Record<string, PersonLite>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [notesCount, setNotesCount] = useState(0);
  const [docsCount, setDocsCount] = useState(0);

  const [editOpen, setEditOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);

  const load = async () => {
    if (!leadId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("leads").select("*").eq("id", leadId).maybeSingle();
    if (error || !data) {
      setLoading(false);
      setLead(null);
      return;
    }
    const row = {
      ...data,
      proposed_scope_of_services: Array.isArray(data.proposed_scope_of_services)
        ? data.proposed_scope_of_services
        : (data.proposed_scope_of_services as any) ?? [],
    } as unknown as LeadRow;
    setLead(row);

    const ids = [row.primary_contact_id, row.company_id, row.assignee_id].filter(Boolean) as string[];
    if (ids.length) {
      const { data: ppl } = await supabase
        .from("people").select("id, first_name, last_name, company, phone, email").in("id", ids);
      const map: Record<string, PersonLite> = {};
      for (const p of ppl ?? []) map[p.id] = p as PersonLite;
      setPeople(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [leadId]);

  if (loading) {
    return <div className="h-64 bg-muted/40 animate-pulse rounded-sm" />;
  }
  if (!lead) {
    return (
      <EmptyState
        title="Lead not found"
        description="It may have been deleted or the link is incorrect."
        action={<Button onClick={() => navigate("/leads")}>Back to leads</Button>}
      />
    );
  }

  const contact = people[lead.primary_contact_id];
  const company = lead.company_id ? people[lead.company_id] : null;
  const assignee = lead.assignee_id ? people[lead.assignee_id] : null;
  const days = getStageAgingDays(lead);
  const stuck = isStageStuck(lead, 14);
  const dToClose = getDaysToClose(lead.target_close_date);
  const closeOverdue = dToClose != null && dToClose < 0 && !TERMINAL_STATUSES.includes(lead.status);
  const onHold = lead.status === "on_hold";
  const isTerminal = TERMINAL_STATUSES.includes(lead.status);

  const headerName = contact
    ? `${contact.first_name} ${contact.last_name}`.trim()
    : company?.company ?? "Lead";

  return (
    <TooltipProvider>
      <div className="space-y-8">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 mono text-[11px] uppercase tracking-wider text-muted-foreground">
          <Link to="/" className="hover:text-architect">Home</Link>
          <span>/</span>
          <Link to="/leads" className="hover:text-architect">Leads</Link>
        </div>

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="label-eyebrow text-true-taupe">
              Lead · <span className="mono">{lead.lead_number}</span>
            </span>
            <span className={cn(
              "px-1.5 py-0.5 border rounded-sm text-[10px] uppercase tracking-wider",
              LEAD_STATUS_STYLES[lead.status],
            )}>
              {LEAD_STATUS_LABELS[lead.status]}
            </span>
          </div>
          <h1 className="font-display text-4xl text-architect leading-tight">{headerName}</h1>
          <div className="text-sm text-muted-foreground">
            {LEAD_SOURCE_LABELS[lead.source]}
            {lead.portfolio_description && (
              <> · <span className="italic">{lead.portfolio_description}</span></>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2 pb-6 border-b hairline">
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              {!isTerminal && !onHold && (
                <Button variant="outline" size="sm" onClick={() => setStageOpen(true)}>
                  <Activity className="h-3.5 w-3.5" /> Change stage
                </Button>
              )}
              {!isTerminal && (
                <Button variant="outline" size="sm" onClick={() => setReassignOpen(true)}>
                  <User className="h-3.5 w-3.5" /> Reassign
                </Button>
              )}
              {!isTerminal && (
                <Button variant="gold" size="sm" onClick={() => setSignOpen(true)}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark contract signed
                </Button>
              )}
              {!isTerminal && (
                <Button variant="outline" size="sm" onClick={() => setLostOpen(true)}>
                  <XCircle className="h-3.5 w-3.5" /> Mark lost
                </Button>
              )}
              {!isTerminal && !onHold && (
                <Button variant="outline" size="sm" onClick={() => setHoldOpen(true)}>
                  <PauseCircle className="h-3.5 w-3.5" /> Put on hold
                </Button>
              )}
              {onHold && (
                <Button variant="gold" size="sm" onClick={() => setResumeOpen(true)}>
                  <PlayCircle className="h-3.5 w-3.5" /> Resume
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
              {isAdmin ? (
                <DropdownMenuItem
                  onSelect={() => setDeleteOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete lead
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </div>

        {/* Banners */}
        {stuck && (
          <Banner tone="amber" icon={<AlertTriangle className="h-4 w-4" />}>
            This lead has been in {LEAD_STATUS_LABELS[lead.status]} for {days} days.
            Consider following up or moving stages.
          </Banner>
        )}
        {onHold && lead.hold_reason && (
          <Banner tone="amber" icon={<PauseCircle className="h-4 w-4" />}>
            <span className="font-medium">On hold:</span> {lead.hold_reason}
          </Banner>
        )}
        {lead.status === "lost" && lead.lost_reason && (
          <Banner tone="red" icon={<XCircle className="h-4 w-4" />}>
            <span className="font-medium">Lost:</span> {LEAD_LOST_REASON_LABELS[lead.lost_reason]}
            {lead.lost_reason_notes && <> — {lead.lost_reason_notes}</>}
          </Banner>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card label="Stage">
            <span className={cn(
              "inline-block px-1.5 py-0.5 border rounded-sm text-[10px] uppercase tracking-wider",
              LEAD_STATUS_STYLES[lead.status],
            )}>
              {LEAD_STATUS_LABELS[lead.status]}
            </span>
            <div className="text-[11px] text-muted-foreground mt-1.5">
              {days} day{days === 1 ? "" : "s"} in stage
            </div>
          </Card>
          <Card label="Estimated value">
            {lead.estimated_annual_fee != null ? (
              <>
                <div className="text-sm text-architect">
                  {formatCurrency(Number(lead.estimated_annual_fee), lead.currency)}/yr
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {lead.probability_percent ?? 0}% · weighted{" "}
                  {formatCurrency(getWeightedValue(lead), lead.currency)}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground italic">Not estimated</div>
            )}
          </Card>
          <Card label="Contact">
            {contact ? (
              <div>
                <Link to={`/people/${contact.id}`} className="text-sm text-architect hover:underline">
                  {contact.first_name} {contact.last_name}
                </Link>
                {company && (
                  <div className="text-[11px] text-muted-foreground">
                    at {company.company || `${company.first_name} ${company.last_name}`}
                  </div>
                )}
                {contact.phone && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(contact.phone!); toast.success("Phone copied."); }}
                    className="text-[11px] text-muted-foreground hover:text-architect inline-flex items-center gap-1 mt-0.5"
                  >
                    <Phone className="h-3 w-3" /> {contact.phone}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic">No contact</div>
            )}
          </Card>
          <Card label="Assignee">
            {assignee ? (
              <button onClick={() => setReassignOpen(true)} className="text-left">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 bg-architect text-chalk rounded-sm flex items-center justify-center text-[10px] font-display">
                    {initials(assignee.first_name, assignee.last_name)}
                  </div>
                  <span className="text-sm text-architect hover:underline">
                    {assignee.first_name} {assignee.last_name}
                  </span>
                </div>
              </button>
            ) : (
              <button
                onClick={() => canEdit && setReassignOpen(true)}
                className="text-sm text-muted-foreground italic hover:text-architect"
              >
                Unassigned
              </button>
            )}
          </Card>
          <Card label="Target close">
            {lead.target_close_date ? (
              <>
                <div className="text-sm text-architect">
                  {format(new Date(lead.target_close_date + "T00:00:00"), "MMM d, yyyy")}
                </div>
                <div className={cn(
                  "text-[11px] mt-1",
                  closeOverdue ? "text-destructive" : "text-muted-foreground",
                )}>
                  {dToClose != null && dToClose >= 0 && `in ${dToClose} day${dToClose === 1 ? "" : "s"}`}
                  {dToClose != null && dToClose < 0 && `${Math.abs(dToClose)} day${Math.abs(dToClose) === 1 ? "" : "s"} overdue`}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground italic">No target</div>
            )}
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activities">
              Activities {notesCount > 0 && <span className="ml-1 text-muted-foreground">({notesCount})</span>}
            </TabsTrigger>
            <TabsTrigger value="documents">
              Documents {docsCount > 0 && <span className="ml-1 text-muted-foreground">({docsCount})</span>}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            <SectionPanel title="Contact">
              {contact ? (
                <>
                  <Field label="Primary contact">
                    <Link to={`/people/${contact.id}`} className="text-architect hover:underline">
                      {contact.first_name} {contact.last_name}
                    </Link>
                  </Field>
                  <Field label="Phone" value={contact.phone ?? "—"} />
                  <Field label="Email" value={contact.email ?? "—"} />
                  {company && (
                    <Field label="Company">
                      <Link to={`/people/${company.id}`} className="text-architect hover:underline">
                        {company.company || `${company.first_name} ${company.last_name}`}
                      </Link>
                    </Field>
                  )}
                </>
              ) : <Field label="" value="No contact set" />}
            </SectionPanel>

            <SectionPanel title="Source">
              <Field label="Source" value={LEAD_SOURCE_LABELS[lead.source]} />
              {lead.source_details && <Field label="Details" value={lead.source_details} />}
            </SectionPanel>

            <SectionPanel title="Sizing">
              <Field
                label="Property count (est.)"
                value={lead.property_count_estimated?.toString() ?? "—"}
              />
              <Field
                label="Portfolio description"
                value={lead.portfolio_description ?? "—"}
              />
            </SectionPanel>

            <SectionPanel title="Proposed terms">
              <Field
                label="Fee model"
                value={lead.proposed_fee_model ? FEE_MODEL_LABELS[lead.proposed_fee_model as keyof typeof FEE_MODEL_LABELS] : "—"}
              />
              <Field
                label="Fee value"
                value={lead.proposed_fee_value != null
                  ? lead.proposed_fee_model === "percentage_of_rent"
                    ? `${lead.proposed_fee_value}%`
                    : formatCurrency(Number(lead.proposed_fee_value), lead.currency)
                  : "—"}
              />
              {lead.proposed_fee_applies_to && (
                <Field label="Applies to" value={formatEnumLabel(lead.proposed_fee_applies_to)} />
              )}
              <Field
                label="Duration"
                value={lead.proposed_duration_months ? `${lead.proposed_duration_months} months` : "—"}
              />
              <Field label="Scope of services">
                {lead.proposed_scope_of_services.length === 0 ? (
                  <span className="text-muted-foreground italic">Not specified</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {(lead.proposed_scope_of_services as ScopeService[]).map((s) => (
                      <span key={s} className="px-1.5 py-0.5 rounded-sm bg-muted/40 text-[10px] text-architect">
                        {SCOPE_LABELS[s] ?? s}
                      </span>
                    ))}
                  </div>
                )}
              </Field>
              {lead.proposed_terms_notes && (
                <Field label="Notes" value={lead.proposed_terms_notes} />
              )}
            </SectionPanel>

            <SectionPanel title="Forecasting">
              <Field
                label="Estimated annual fee"
                value={lead.estimated_annual_fee != null
                  ? formatCurrency(Number(lead.estimated_annual_fee), lead.currency)
                  : "—"}
              />
              <Field
                label="Probability"
                value={lead.probability_percent != null ? `${lead.probability_percent}%` : "—"}
              />
              <Field
                label="Weighted value"
                value={formatCurrency(getWeightedValue(lead), lead.currency)}
              />
              <Field
                label="Target close"
                value={lead.target_close_date
                  ? format(new Date(lead.target_close_date + "T00:00:00"), "MMM d, yyyy")
                  : "—"}
              />
            </SectionPanel>

            {lead.notes && (
              <SectionPanel title="Notes">
                <div className="text-sm whitespace-pre-wrap text-architect col-span-2">{lead.notes}</div>
              </SectionPanel>
            )}
          </TabsContent>

          <TabsContent value="activities" className="mt-6">
            <NotesPanel
              entityType={"lead" as any}
              entityId={lead.id}
              onCountChange={setNotesCount}
            />
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <DocumentList
              entityType={"lead" as any}
              entityId={lead.id}
              editable={canEdit}
              onCountChange={setDocsCount}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <LeadHistoryTab leadId={lead.id} />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <NewLeadDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          editLead={lead}
          onSaved={() => { setEditOpen(false); load(); }}
        />
        <ChangeStageDialog
          open={stageOpen}
          onOpenChange={setStageOpen}
          lead={lead}
          onSaved={load}
        />
        <ReassignLeadDialog
          open={reassignOpen}
          onOpenChange={setReassignOpen}
          lead={lead}
          onSaved={load}
        />
        <MarkLostDialog
          open={lostOpen}
          onOpenChange={setLostOpen}
          lead={lead}
          onSaved={load}
        />
        <PutOnHoldDialog
          open={holdOpen}
          onOpenChange={setHoldOpen}
          lead={lead}
          onSaved={load}
        />
        <ResumeFromHoldDialog
          open={resumeOpen}
          onOpenChange={setResumeOpen}
          lead={lead}
          onSaved={load}
        />
        <DeleteLeadDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          lead={lead}
        />
        <MarkContractSignedDialog
          open={signOpen}
          onOpenChange={setSignOpen}
          lead={lead}
          onConverted={() => { setSignOpen(false); load(); }}
        />
      </div>
    </TooltipProvider>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border hairline rounded-sm bg-card p-3">
      <div className="label-eyebrow mb-1.5">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function SectionPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border hairline rounded-sm bg-card p-5">
      <div className="label-eyebrow mb-4">{title}</div>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">{children}</dl>
    </section>
  );
}

function Field({
  label, value, children,
}: { label: string; value?: string | null; children?: React.ReactNode }) {
  return (
    <div className="text-sm">
      {label && <dt className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</dt>}
      <dd className="text-architect">
        {children ?? (value ?? "—")}
      </dd>
    </div>
  );
}

function Banner({
  tone, icon, children,
}: { tone: "amber" | "red"; icon: React.ReactNode; children: React.ReactNode }) {
  const toneClasses =
    tone === "red"
      ? "bg-destructive/5 border-destructive/30 text-destructive"
      : "bg-amber-500/5 border-amber-500/30 text-amber-800";
  return (
    <div className={cn("flex items-start gap-2 px-4 py-3 border rounded-sm text-sm", toneClasses)}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
