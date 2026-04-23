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
  approval_status: ServiceRequestApprovalStatus;
  approval_required_reason: string | null;
  approval_threshold_amount: number | null;
  approval_threshold_currency: string | null;
  approval_rule_snapshot: string | null;
  approval_management_agreement_id: string | null;
  approval_requested_at: string | null;
  approval_decided_at: string | null;
  approval_decision_notes: string | null;
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

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [r, s, e] = await Promise.all([
      supabase.from("service_requests").select("*").eq("id", id).maybeSingle(),
      supabase.from("service_request_steps").select("*").eq("request_id", id).order("sort_order"),
      supabase
        .from("service_request_events")
        .select("*")
        .eq("request_id", id)
        .order("created_at", { ascending: false }),
    ]);
    if (!r.data) {
      toast.error("Request not found");
      navigate("/services");
      return;
    }
    setReq(r.data as any);
    setSteps((s.data ?? []) as any);
    setEvents((e.data ?? []) as any);
    setInternalNotes((r.data as any).internal_notes ?? "");

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
        </CardContent>
      </Card>

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