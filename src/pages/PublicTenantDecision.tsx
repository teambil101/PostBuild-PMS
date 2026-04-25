import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  ShieldCheck,
  ShieldX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface RequestCtx {
  id: string;
  request_number: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  target_label: string;
  currency: string;
  cost_estimate: number | null;
  bill_to: string;
  billing: string;

  tenant_approval_required: boolean;
  tenant_approval_status: "not_required" | "pending" | "approved" | "rejected";
  tenant_approval_reason: string | null;
  tenant_approval_decided_at: string | null;

  proposed_scheduled_date: string | null;
  tenant_schedule_status: "none" | "proposed" | "confirmed" | "rescheduled";
  tenant_proposed_date: string | null;
  tenant_schedule_notes: string | null;
  schedule_counter_round: number;
  scheduled_date: string | null;
}

export default function PublicTenantDecision() {
  const { token } = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<RequestCtx | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approval form
  const [approvalNotes, setApprovalNotes] = useState("");
  const [approvalWorking, setApprovalWorking] = useState(false);

  // Schedule form
  const [counterDate, setCounterDate] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduleWorking, setScheduleWorking] = useState<"confirm" | "counter" | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    const { data: req, error: rErr } = await supabase
      .from("service_requests")
      .select(
        "id, request_number, title, description, category, priority, target_type, target_id, currency, cost_estimate, bill_to, billing, tenant_approval_required, tenant_approval_status, tenant_approval_reason, tenant_approval_decided_at, proposed_scheduled_date, tenant_schedule_status, tenant_proposed_date, tenant_schedule_notes, schedule_counter_round, scheduled_date",
      )
      .eq("tenant_token", token)
      .maybeSingle();

    if (rErr || !req) {
      setError("This link is invalid or no longer active.");
      setLoading(false);
      return;
    }

    let targetLabel = "Property";
    if (req.target_type === "unit" && req.target_id) {
      const { data: unit } = await supabase
        .from("units")
        .select("unit_number, buildings(name, city)")
        .eq("id", req.target_id)
        .maybeSingle();
      if (unit) {
        const b: any = (unit as any).buildings;
        targetLabel = `${b?.name ?? ""} · Unit ${unit.unit_number}${b?.city ? ` · ${b.city}` : ""}`.trim();
      }
    } else if (req.target_type === "building" && req.target_id) {
      const { data: b } = await supabase
        .from("buildings")
        .select("name, city")
        .eq("id", req.target_id)
        .maybeSingle();
      if (b) targetLabel = `${b.name}${b.city ? ` · ${b.city}` : ""}`;
    }

    setCtx({ ...(req as any), target_label: targetLabel });
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [token]);

  const decide = async (decision: "approved" | "rejected") => {
    if (!token) return;
    setApprovalWorking(true);
    const { error: dErr } = await supabase.rpc("decide_tenant_approval", {
      p_token: token,
      p_decision: decision,
      p_notes: approvalNotes.trim() || null,
    });
    setApprovalWorking(false);
    if (dErr) {
      toast.error(dErr.message);
      return;
    }
    toast.success(decision === "approved" ? "Thank you — approved" : "Recorded — rejected");
    await load();
  };

  const respondSchedule = async (action: "confirm" | "counter") => {
    if (!token) return;
    if (action === "counter" && !counterDate) {
      toast.error("Please pick your preferred date");
      return;
    }
    setScheduleWorking(action);
    const { error: sErr } = await supabase.rpc("respond_to_schedule", {
      p_token: token,
      p_action: action,
      p_counter_date: action === "counter" ? counterDate : null,
      p_notes: scheduleNotes.trim() || null,
    });
    setScheduleWorking(null);
    if (sErr) {
      toast.error(sErr.message);
      return;
    }
    toast.success(action === "confirm" ? "Date confirmed — thank you" : "Counter-proposal sent");
    setCounterDate("");
    setScheduleNotes("");
    await load();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="hairline max-w-md w-full">
          <CardContent className="py-10 text-center space-y-2">
            <div className="text-base font-medium text-architect">{error}</div>
            <p className="text-sm text-muted-foreground">
              Please contact your property manager.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ctx) return null;

  const showApproval =
    ctx.tenant_approval_required && ctx.tenant_approval_status !== "not_required";
  const showSchedule =
    ctx.tenant_schedule_status === "proposed" || ctx.tenant_schedule_status === "rescheduled" || ctx.tenant_schedule_status === "confirmed";
  const counterLimitReached = ctx.schedule_counter_round >= 2;

  return (
    <div className="min-h-screen bg-muted/20 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Service request
          </div>
          <div className="text-lg text-architect mt-1">{ctx.request_number}</div>
        </div>

        <Card className="hairline">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base">{ctx.title}</CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {ctx.category.replace(/_/g, " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Location</div>
              <div className="text-architect">{ctx.target_label}</div>
            </div>
            {ctx.description && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Details</div>
                <p className="text-architect whitespace-pre-wrap">{ctx.description}</p>
              </div>
            )}
            {ctx.cost_estimate != null && ctx.billing === "paid" && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Estimated cost</div>
                <div className="text-architect mono tabular-nums">
                  {ctx.currency} {Number(ctx.cost_estimate).toLocaleString()}
                  {ctx.bill_to === "tenant" && (
                    <span className="ml-2 text-xs text-amber-700">· billed to you</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval */}
        {showApproval && (
          <Card className="hairline">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Your approval</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ctx.tenant_approval_reason && (
                <p className="text-sm text-architect bg-muted/30 rounded px-3 py-2 whitespace-pre-wrap">
                  {ctx.tenant_approval_reason}
                </p>
              )}

              {ctx.tenant_approval_status === "approved" ? (
                <div className="flex items-center gap-2 text-status-occupied text-sm">
                  <ShieldCheck className="h-4 w-4" />
                  You approved this on{" "}
                  {ctx.tenant_approval_decided_at &&
                    format(new Date(ctx.tenant_approval_decided_at), "d MMM yyyy")}
                </div>
              ) : ctx.tenant_approval_status === "rejected" ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <ShieldX className="h-4 w-4" />
                    You rejected this on{" "}
                    {ctx.tenant_approval_decided_at &&
                      format(new Date(ctx.tenant_approval_decided_at), "d MMM yyyy")}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => decide("approved")}
                    disabled={approvalWorking}
                  >
                    Change to approved
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="anotes" className="text-xs">
                      Add a note (optional)
                    </Label>
                    <Textarea
                      id="anotes"
                      rows={3}
                      placeholder="Anything the property manager should know…"
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => decide("rejected")}
                      disabled={approvalWorking}
                    >
                      <ShieldX className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                    <Button onClick={() => decide("approved")} disabled={approvalWorking}>
                      {approvalWorking ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      Approve
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Schedule */}
        {showSchedule && (
          <Card className="hairline">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Proposed visit date
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {ctx.proposed_scheduled_date && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Manager proposes
                  </div>
                  <div className="text-architect mono tabular-nums">
                    {format(new Date(ctx.proposed_scheduled_date), "EEEE d MMM yyyy")}
                  </div>
                </div>
              )}

              {ctx.tenant_schedule_status === "confirmed" ? (
                <div className="flex items-center gap-2 text-status-occupied">
                  <CheckCircle2 className="h-4 w-4" />
                  You confirmed this date.
                </div>
              ) : ctx.tenant_schedule_status === "rescheduled" ? (
                <>
                  {ctx.tenant_proposed_date && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        You counter-proposed
                      </div>
                      <div className="text-blue-700 mono tabular-nums">
                        {format(new Date(ctx.tenant_proposed_date), "EEEE d MMM yyyy")}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Awaiting manager response.
                  </div>
                  {!counterLimitReached && (
                    <p className="text-xs text-muted-foreground">
                      You can also confirm the original date below or counter again.
                    </p>
                  )}
                </>
              ) : null}

              {ctx.tenant_schedule_status !== "confirmed" && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <Button onClick={() => respondSchedule("confirm")} disabled={!!scheduleWorking}>
                      {scheduleWorking === "confirm" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Confirm proposed date
                    </Button>
                  </div>

                  {!counterLimitReached && (
                    <div className="border-t hairline pt-3 space-y-2">
                      <Label htmlFor="counter" className="text-xs">
                        Or propose a different date{" "}
                        <span className="text-muted-foreground">
                          (round {ctx.schedule_counter_round + 1}/2)
                        </span>
                      </Label>
                      <Input
                        id="counter"
                        type="date"
                        value={counterDate}
                        onChange={(e) => setCounterDate(e.target.value)}
                      />
                      <Textarea
                        rows={2}
                        placeholder="Note (optional) — best times, parking, etc."
                        value={scheduleNotes}
                        onChange={(e) => setScheduleNotes(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          onClick={() => respondSchedule("counter")}
                          disabled={!!scheduleWorking || !counterDate}
                        >
                          {scheduleWorking === "counter" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Send counter-proposal
                        </Button>
                      </div>
                    </div>
                  )}

                  {counterLimitReached && (
                    <p className="text-xs text-amber-700 bg-amber-500/5 border border-amber-500/30 rounded px-3 py-2">
                      You've used both counter-proposal rounds. Please confirm the manager's date or contact them directly.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!showApproval && !showSchedule && (
          <Card className="hairline">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nothing requires your action right now.
            </CardContent>
          </Card>
        )}

        <p className="text-[10px] text-center text-muted-foreground pt-2">
          This link is unique to this request. Do not share it.
        </p>
      </div>
    </div>
  );
}