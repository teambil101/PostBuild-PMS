import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Pause,
  Play,
  Plus,
  Star,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { RequestStatusBadge } from "@/components/services/RequestStatusBadge";
import { BillingBadge, DeliveryBadge } from "@/components/services/CatalogBadges";
import { ApprovalCard } from "@/components/services/ApprovalCard";
import { StepCard, type WorkflowStepRow } from "@/components/services/StepCard";
import { AddStepDialog } from "@/components/services/AddStepDialog";
import { RecordFeedbackDialog } from "@/components/services/RecordFeedbackDialog";
import { QuotesCard } from "@/components/services/QuotesCard";
import { TenantCoordinationCard } from "@/components/services/TenantCoordinationCard";
import { CostSplitAndApprovalCard } from "@/components/services/CostSplitAndApprovalCard";
import type { BillToMode, PartyCostApprovalStatus } from "@/lib/vendor-services";
import {
  PRIORITY_LABEL,
  PRIORITY_STYLES,
  type ServiceRequestPriority,
  type ServiceRequestStatus,
  type ServiceCategory,
  type ServiceDelivery,
  type ServiceBilling,
  type ServiceRequestApprovalStatus,
} from "@/lib/services";
import { cn } from "@/lib/utils";

interface RequestRow {
  id: string;
  request_number: string;
  title: string;
  status: ServiceRequestStatus;
  priority: ServiceRequestPriority;
  is_workflow: boolean;
  category: ServiceCategory;
  delivery: ServiceDelivery;
  billing: ServiceBilling;
  target_type: string;
  target_id: string | null;
  scheduled_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  cost_estimate: number | null;
  cost_final: number | null;
  currency: string;
  description: string | null;
  internal_notes: string | null;
  created_at: string;
  assigned_vendor_id: string | null;
  assigned_person_id: string | null;
  approval_status: ServiceRequestApprovalStatus;
  approval_required_reason: string | null;
  approval_threshold_amount: number | null;
  approval_threshold_currency: string | null;
  approval_rule_snapshot: string | null;
  approval_management_agreement_id: string | null;
  approval_requested_at: string | null;
  approval_decided_at: string | null;
  approval_decision_notes: string | null;
  bill_to: string;
  tenant_token: string | null;
  tenant_approval_required: boolean;
  tenant_approval_status: "not_required" | "pending" | "approved" | "rejected";
  tenant_approval_reason: string | null;
  tenant_approval_requested_at: string | null;
  tenant_approval_decided_at: string | null;
  tenant_approval_notes: string | null;
  proposed_scheduled_date: string | null;
  tenant_schedule_status: "none" | "proposed" | "confirmed" | "rescheduled";
  tenant_proposed_date: string | null;
  tenant_schedule_notes: string | null;
  schedule_counter_round: number;
  bill_to_mode?: BillToMode;
  landlord_share_percent?: number;
  tenant_share_percent?: number;
  winning_quote_id?: string | null;
  landlord_cost_approval_status?: PartyCostApprovalStatus;
  tenant_cost_approval_status?: PartyCostApprovalStatus;
  landlord_cost_approved_at?: string | null;
  tenant_cost_approved_at?: string | null;
  service_area_city?: string | null;
  service_area_community?: string | null;
}

interface StepRow {
  id: string;
  request_id: string;
  step_key: string;
  title: string;
  sort_order: number;
  category: ServiceCategory;
  delivery: ServiceDelivery;
  billing: ServiceBilling;
  blocks_next: boolean;
  status: WorkflowStepRow["status"];
  completed_at: string | null;
  notes: string | null;
  scheduled_date: string | null;
  assigned_vendor_id: string | null;
  assigned_person_id: string | null;
  cost_estimate: number | null;
  cost_final: number | null;
  approval_status: ServiceRequestApprovalStatus;
  approval_required_reason: string | null;
  approval_threshold_amount: number | null;
  approval_threshold_currency: string | null;
  approval_rule_snapshot: string | null;
  approval_decision_notes: string | null;
}

interface EventRow {
  id: string;
  event_type: string;
  description: string | null;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export default function ServiceRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [req, setReq] = useState<RequestRow | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [target, setTarget] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [internalNotes, setInternalNotes] = useState("");
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [vendorLabels, setVendorLabels] = useState<Record<string, string>>({});
  const [personLabels, setPersonLabels] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ id: string; rating: number; comment: string | null; submitted_at: string } | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [winningQuote, setWinningQuote] = useState<{
    id: string;
    amount: number | null;
    currency: string;
    vendor_id: string;
  } | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [r, s, e, f] = await Promise.all([
      supabase.from("service_requests").select("*").eq("id", id).maybeSingle(),
      supabase.from("service_request_steps").select("*").eq("request_id", id).order("sort_order"),
      supabase
        .from("service_request_events")
        .select("*")
        .eq("request_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("service_feedback")
        .select("id, rating, comment, submitted_at")
        .eq("service_request_id", id)
        .maybeSingle(),
    ]);
    if (!r.data) {
      toast.error("Request not found");
      navigate("/services");
      return;
    }
    setReq(r.data as any);
    setSteps((s.data ?? []) as any);
    setEvents((e.data ?? []) as any);
    setFeedback((f.data as any) ?? null);
    setInternalNotes((r.data as any).internal_notes ?? "");

    // Resolve winning quote, if any
    const wqId = (r.data as any).winning_quote_id as string | null;
    if (wqId) {
      const { data: wq } = await supabase
        .from("service_request_quotes")
        .select("id, amount, currency, vendor_id")
        .eq("id", wqId)
        .maybeSingle();
      setWinningQuote(wq as any);
    } else {
      setWinningQuote(null);
    }

    // Fetch labels for assigned vendors / persons
    const stepRows: any[] = (s.data ?? []) as any[];
    const vendorIds = Array.from(new Set(stepRows.map((x) => x.assigned_vendor_id).filter(Boolean)));
    const personIds = Array.from(new Set(stepRows.map((x) => x.assigned_person_id).filter(Boolean)));
    if (vendorIds.length) {
      const { data: vData } = await supabase
        .from("vendors")
        .select("id, legal_name, display_name")
        .in("id", vendorIds as string[]);
      const map: Record<string, string> = {};
      (vData ?? []).forEach((v: any) => { map[v.id] = v.display_name || v.legal_name; });
      setVendorLabels(map);
    } else {
      setVendorLabels({});
    }
    if (personIds.length) {
      const { data: pData } = await supabase
        .from("people")
        .select("id, first_name, last_name")
        .in("id", personIds as string[]);
      const map: Record<string, string> = {};
      (pData ?? []).forEach((p: any) => { map[p.id] = `${p.first_name} ${p.last_name}`.trim(); });
      setPersonLabels(map);
    } else {
      setPersonLabels({});
    }

    // Resolve target label
    if (r.data.target_type === "unit" && r.data.target_id) {
      const u = await supabase
        .from("units")
        .select("unit_number,buildings(name)")
        .eq("id", r.data.target_id)
        .maybeSingle();
      if (u.data) setTarget(`${(u.data as any).buildings?.name ?? ""} · Unit ${u.data.unit_number}`);
    } else if (r.data.target_type === "building" && r.data.target_id) {
      const b = await supabase.from("buildings").select("name").eq("id", r.data.target_id).maybeSingle();
      if (b.data) setTarget(`${b.data.name} (legacy: building-level)`);
    } else {
      setTarget("Portfolio-level (legacy)");
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [id]);

  const transition = async (newStatus: ServiceRequestStatus, label: string) => {
    if (!req) return;
    setWorking(true);
    const updates: any = { status: newStatus };
    if (newStatus === "in_progress" && !req.started_at) updates.started_at = new Date().toISOString();
    if (newStatus === "completed") updates.completed_at = new Date().toISOString();

    const { error } = await supabase.from("service_requests").update(updates).eq("id", req.id);
    if (error) {
      toast.error(error.message);
      setWorking(false);
      return;
    }
    await supabase.from("service_request_events").insert({
      request_id: req.id,
      event_type: "status_change",
      description: label,
      from_value: req.status,
      to_value: newStatus,
    });
    toast.success(label);
    setWorking(false);
    await load();
  };

  const moveStep = async (stepId: string, direction: "up" | "down") => {
    if (!req) return;
    const ordered = [...steps].sort((a, b) => a.sort_order - b.sort_order);
    const idx = ordered.findIndex((s) => s.id === stepId);
    if (idx < 0) return;
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= ordered.length) return;
    const reordered = [...ordered];
    [reordered[idx], reordered[swapWith]] = [reordered[swapWith], reordered[idx]];
    const { error } = await supabase.rpc("reorder_service_request_steps", {
      p_request_id: req.id,
      p_step_ids: reordered.map((s) => s.id),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
  };

  const saveNotes = async () => {
    if (!req) return;
    const { error } = await supabase
      .from("service_requests")
      .update({ internal_notes: internalNotes.trim() || null })
      .eq("id", req.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Notes saved");
  };

  if (loading || !req) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const totalSteps = steps.length;
  const progress = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const allStepsDone = totalSteps > 0 && completedSteps === totalSteps;
  const blockedByApproval = req.approval_status === "pending" || req.approval_status === "rejected";
  const approvalBlockTitle =
    req.approval_status === "pending"
      ? "Awaiting landlord approval"
      : req.approval_status === "rejected"
        ? "Approval was rejected — re-request to proceed"
        : "";

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
        <Link to="/services?tab=requests">
          <ArrowLeft className="h-4 w-4" />
          Back to requests
        </Link>
      </Button>

      <PageHeader
        eyebrow={`${req.request_number} · ${req.category.replace(/_/g, " ")}${req.is_workflow ? " · Workflow" : ""}`}
        title={req.title}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <RequestStatusBadge status={req.status} />
            <span className={cn("text-[11px] uppercase tracking-wider", PRIORITY_STYLES[req.priority])}>
              {PRIORITY_LABEL[req.priority]} priority
            </span>
          </div>
        }
      />

      {req.approval_status !== "not_required" && (
        <div className="mb-6">
          <ApprovalCard
            requestId={req.id}
            status={req.approval_status}
            reason={req.approval_required_reason}
            ruleSnapshot={req.approval_rule_snapshot}
            thresholdAmount={req.approval_threshold_amount}
            thresholdCurrency={req.approval_threshold_currency}
            managementAgreementId={req.approval_management_agreement_id}
            requestedAt={req.approval_requested_at}
            decidedAt={req.approval_decided_at}
            decisionNotes={req.approval_decision_notes}
            onChanged={load}
          />
        </div>
      )}

      {/* Status transition bar */}
      <Card className="hairline mb-6">
        <CardContent className="pt-4 pb-4 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">Actions:</span>
          {req.status === "open" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => transition("scheduled", "Scheduled")}
              disabled={working || blockedByApproval}
              title={blockedByApproval ? approvalBlockTitle : ""}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Mark scheduled
            </Button>
          )}
          {(req.status === "open" || req.status === "scheduled") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => transition("in_progress", "Started work")}
              disabled={working || blockedByApproval}
              title={blockedByApproval ? approvalBlockTitle : ""}
            >
              <Play className="h-3.5 w-3.5" />
              Start work
            </Button>
          )}
          {req.status === "in_progress" && (
            <Button size="sm" variant="outline" onClick={() => transition("blocked", "Blocked")} disabled={working}>
              <Pause className="h-3.5 w-3.5" />
              Block
            </Button>
          )}
          {req.status === "blocked" && (
            <Button size="sm" variant="outline" onClick={() => transition("in_progress", "Resumed")} disabled={working}>
              <Play className="h-3.5 w-3.5" />
              Resume
            </Button>
          )}
          {["scheduled", "in_progress", "blocked", "open"].includes(req.status) && (
            <Button
              size="sm"
              onClick={() => transition("completed", "Completed")}
              disabled={working || (req.is_workflow && !allStepsDone)}
              title={req.is_workflow && !allStepsDone ? "Complete all steps first" : ""}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Complete
            </Button>
          )}
          {req.status !== "completed" && req.status !== "cancelled" && (
            <Button size="sm" variant="ghost" onClick={() => transition("cancelled", "Cancelled")} disabled={working}>
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </Button>
          )}
          {req.status === "completed" && (
            <Button
              size="sm"
              variant={feedback ? "outline" : "default"}
              onClick={() => setFeedbackOpen(true)}
              className="ml-auto"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {feedback ? "Update feedback" : "Record customer feedback"}
            </Button>
          )}
        </CardContent>
      </Card>

      {feedback && (
        <Card className="hairline mb-6 bg-muted/20">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={cn(
                    "h-4 w-4",
                    n <= feedback.rating ? "fill-gold text-gold" : "text-muted-foreground/30",
                  )}
                  strokeWidth={1.5}
                />
              ))}
              <span className="ml-2 mono text-xs text-architect tabular-nums">
                {feedback.rating}/5
              </span>
            </div>
            <div className="flex-1 min-w-0">
              {feedback.comment ? (
                <p className="text-sm text-architect whitespace-pre-wrap">{feedback.comment}</p>
              ) : (
                <p className="text-xs text-muted-foreground italic">No comment recorded.</p>
              )}
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                Customer feedback · {format(new Date(feedback.submitted_at), "d MMM yyyy")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <RecordFeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        serviceRequestId={req.id}
        existing={feedback}
        onSaved={load}
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {req.is_workflow && (
            <TabsTrigger value="steps">
              Steps <span className="ml-1.5 text-[10px] opacity-70">{completedSteps}/{totalSteps}</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="history">History ({events.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="hairline">
              <CardHeader>
                <CardTitle className="text-sm">Target</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-architect">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {target}
                </div>
              </CardContent>
            </Card>

            <Card className="hairline">
              <CardHeader>
                <CardTitle className="text-sm">Delivery & billing</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <DeliveryBadge value={req.delivery} />
                <BillingBadge value={req.billing} />
              </CardContent>
            </Card>

            <Card className="hairline">
              <CardHeader>
                <CardTitle className="text-sm">Schedule</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Created {format(new Date(req.created_at), "d MMM yyyy")}
                </div>
                {req.scheduled_date && (
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    Scheduled {format(new Date(req.scheduled_date), "d MMM yyyy")}
                  </div>
                )}
                {req.started_at && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Play className="h-3.5 w-3.5" />
                    Started {format(new Date(req.started_at), "d MMM yyyy")}
                  </div>
                )}
                {req.completed_at && (
                  <div className="flex items-center gap-2 text-status-occupied">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Completed {format(new Date(req.completed_at), "d MMM yyyy")}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="hairline">
              <CardHeader>
                <CardTitle className="text-sm">Cost</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="text-muted-foreground text-xs">Estimate</div>
                <div>{req.cost_estimate ? `${req.currency} ${Number(req.cost_estimate).toLocaleString()}` : "—"}</div>
                <div className="text-muted-foreground text-xs mt-2">Final</div>
                <div>{req.cost_final ? `${req.currency} ${Number(req.cost_final).toLocaleString()}` : "—"}</div>
              </CardContent>
            </Card>
          </div>

          {req.description && (
            <Card className="hairline">
              <CardHeader>
                <CardTitle className="text-sm">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-architect whitespace-pre-wrap">{req.description}</p>
              </CardContent>
            </Card>
          )}

          {(req.delivery === "vendor" || req.delivery === "either") && !req.is_workflow && (
            <QuotesCard
              requestId={req.id}
              category={req.category}
              hasAssignedVendor={!!req.assigned_vendor_id}
              onChanged={load}
            />
          )}

          {(req.delivery === "vendor" || req.delivery === "either") && !req.is_workflow && (
            <CostSplitAndApprovalCard
              requestId={req.id}
              billToMode={(req.bill_to_mode ?? "landlord_only") as BillToMode}
              landlordSharePercent={Number(req.landlord_share_percent ?? 100)}
              tenantSharePercent={Number(req.tenant_share_percent ?? 0)}
              winningQuoteId={req.winning_quote_id ?? null}
              winningQuoteAmount={winningQuote?.amount ?? null}
              winningQuoteCurrency={winningQuote?.currency ?? req.currency}
              winningVendorName={
                winningQuote ? vendorLabels[winningQuote.vendor_id] ?? null : null
              }
              landlordCostApprovalStatus={
                (req.landlord_cost_approval_status ?? "not_required") as PartyCostApprovalStatus
              }
              tenantCostApprovalStatus={
                (req.tenant_cost_approval_status ?? "not_required") as PartyCostApprovalStatus
              }
              landlordCostApprovedAt={req.landlord_cost_approved_at ?? null}
              tenantCostApprovedAt={req.tenant_cost_approved_at ?? null}
              onChanged={load}
            />
          )}

          <TenantCoordinationCard
            requestId={req.id}
            tenantToken={req.tenant_token}
            approvalRequired={req.tenant_approval_required}
            approvalStatus={req.tenant_approval_status}
            approvalReason={req.tenant_approval_reason}
            approvalRequestedAt={req.tenant_approval_requested_at}
            approvalDecidedAt={req.tenant_approval_decided_at}
            approvalNotes={req.tenant_approval_notes}
            proposedScheduledDate={req.proposed_scheduled_date}
            scheduleStatus={req.tenant_schedule_status}
            tenantProposedDate={req.tenant_proposed_date}
            scheduleNotes={req.tenant_schedule_notes}
            counterRound={req.schedule_counter_round}
            scheduledDate={req.scheduled_date}
            billing={req.billing}
            billTo={req.bill_to}
            costEstimate={req.cost_estimate}
            currency={req.currency}
            onChanged={load}
          />

          <Card className="hairline">
            <CardHeader>
              <CardTitle className="text-sm">Internal notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                rows={4}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Notes only visible to staff…"
              />
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={saveNotes}>
                  Save notes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {req.is_workflow && (
          <TabsContent value="steps" className="mt-5 space-y-3">
            <Card className="hairline">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-architect font-medium">
                    {completedSteps} of {totalSteps} steps complete
                  </div>
                  <Badge variant="outline">{progress}%</Badge>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-status-occupied transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="border hairline rounded-sm bg-card divide-y hairline overflow-hidden">
              {steps.map((s, idx) => {
                // Determine if any earlier blocks_next step is incomplete
                const earlier = steps.slice(0, idx);
                const blocker = earlier.find(
                  (e) => e.blocks_next && e.status !== "completed" && e.status !== "skipped",
                );
                return (
                  <StepCard
                    key={s.id}
                    step={s as WorkflowStepRow}
                    index={idx}
                    total={steps.length}
                    gatedByPredecessor={!!blocker}
                    predecessorTitle={blocker?.title}
                    vendorLabel={s.assigned_vendor_id ? vendorLabels[s.assigned_vendor_id] : null}
                    personLabel={s.assigned_person_id ? personLabels[s.assigned_person_id] : null}
                    onChanged={load}
                    onMove={(dir) => moveStep(s.id, dir)}
                  />
                );
              })}
            </div>

            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setAddStepOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add step
              </Button>
            </div>

            <AddStepDialog
              open={addStepOpen}
              onOpenChange={setAddStepOpen}
              requestId={req.id}
              onAdded={load}
            />
          </TabsContent>
        )}

        <TabsContent value="history" className="mt-5">
          {events.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No events yet.</div>
          ) : (
            <div className="border hairline rounded-sm bg-card divide-y hairline overflow-hidden">
              {events.map((ev) => (
                <div key={ev.id} className="px-4 py-3 flex items-start gap-3">
                  <Check className="h-3.5 w-3.5 text-muted-foreground mt-1 shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm text-architect">
                      {ev.description || ev.event_type.replace(/_/g, " ")}
                      {ev.from_value && ev.to_value && (
                        <span className="text-muted-foreground text-xs ml-2">
                          {ev.from_value} → {ev.to_value}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      {format(new Date(ev.created_at), "d MMM yyyy · HH:mm")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}