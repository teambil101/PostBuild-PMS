import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  MapPin,
  Pause,
  Play,
  SkipForward,
  Workflow,
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
import { BillingBadge, CategoryBadge, DeliveryBadge } from "@/components/services/CatalogBadges";
import {
  PRIORITY_LABEL,
  PRIORITY_STYLES,
  STEP_STATUS_LABEL,
  type ServiceRequestPriority,
  type ServiceRequestStatus,
  type ServiceRequestStepStatus,
  type ServiceCategory,
  type ServiceDelivery,
  type ServiceBilling,
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
}

interface StepRow {
  id: string;
  step_key: string;
  title: string;
  sort_order: number;
  category: ServiceCategory;
  delivery: ServiceDelivery;
  billing: ServiceBilling;
  blocks_next: boolean;
  status: ServiceRequestStepStatus;
  completed_at: string | null;
  notes: string | null;
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
      if (b.data) setTarget(b.data.name);
    } else {
      setTarget("Portfolio-level");
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

  const completeStep = async (stepId: string, currentStatus: ServiceRequestStepStatus) => {
    if (!req) return;
    const newStatus: ServiceRequestStepStatus = currentStatus === "completed" ? "pending" : "completed";
    const updates: any = {
      status: newStatus,
      completed_at: newStatus === "completed" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("service_request_steps").update(updates).eq("id", stepId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("service_request_events").insert({
      request_id: req.id,
      step_id: stepId,
      event_type: "step_status_change",
      from_value: currentStatus,
      to_value: newStatus,
    });
    await load();
  };

  const skipStep = async (stepId: string) => {
    if (!req) return;
    const { error } = await supabase
      .from("service_request_steps")
      .update({ status: "skipped" })
      .eq("id", stepId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("service_request_events").insert({
      request_id: req.id,
      step_id: stepId,
      event_type: "step_skipped",
    });
    toast.success("Step skipped");
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

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
        <Link to="/services?tab=requests">
          <ArrowLeft className="h-4 w-4" />
          Back to requests
        </Link>
      </Button>

      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <span className="mono">{req.request_number}</span>
            <span>·</span>
            <CategoryBadge value={req.category} />
            {req.is_workflow && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-architect">
                  <Workflow className="h-3 w-3" />
                  Workflow
                </span>
              </>
            )}
          </span>
        }
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

      {/* Status transition bar */}
      <Card className="hairline mb-6">
        <CardContent className="pt-4 pb-4 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">Actions:</span>
          {req.status === "open" && (
            <Button size="sm" variant="outline" onClick={() => transition("scheduled", "Scheduled")} disabled={working}>
              <CalendarDays className="h-3.5 w-3.5" />
              Mark scheduled
            </Button>
          )}
          {(req.status === "open" || req.status === "scheduled") && (
            <Button size="sm" variant="outline" onClick={() => transition("in_progress", "Started work")} disabled={working}>
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
                const done = s.status === "completed";
                const skipped = s.status === "skipped";
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "px-4 py-3 flex items-start gap-3",
                      skipped && "opacity-50",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => completeStep(s.id, s.status)}
                      className="mt-0.5 shrink-0"
                      disabled={skipped}
                    >
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-status-occupied" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground hover:text-architect transition-colors" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "text-sm",
                            done && "text-muted-foreground line-through",
                            !done && "text-architect",
                          )}
                        >
                          {idx + 1}. {s.title}
                        </span>
                        {s.blocks_next && !done && (
                          <Badge variant="outline" className="text-[9px]">Blocks next</Badge>
                        )}
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          · {STEP_STATUS_LABEL[s.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <CategoryBadge value={s.category} />
                        <DeliveryBadge value={s.delivery} />
                        <BillingBadge value={s.billing} />
                        {s.completed_at && (
                          <span className="text-[10px] text-muted-foreground">
                            · Done {format(new Date(s.completed_at), "d MMM")}
                          </span>
                        )}
                      </div>
                    </div>
                    {!done && !skipped && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => skipStep(s.id)}
                        className="shrink-0"
                      >
                        <SkipForward className="h-3.5 w-3.5" />
                        Skip
                      </Button>
                    )}
                    {done && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => completeStep(s.id, s.status)}
                        className="shrink-0 text-muted-foreground"
                      >
                        Undo
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
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