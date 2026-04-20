import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, Pause, Play, StopCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ServiceScheduleDialog } from "@/components/services/ServiceScheduleDialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FREQUENCY_LABELS, STATUS_LABELS, STATUS_STYLES,
  formatDueCountdown, frequencyEveryPhrase, getScheduleUrgency, urgencyTone,
  type ServiceScheduleRow,
} from "@/lib/services";

interface Vendor { id: string; legal_name: string; display_name: string | null; vendor_number: string }
interface EventRow { id: string; event_type: string; description: string | null; from_value: string | null; to_value: string | null; created_at: string }
interface TicketRow { id: string; ticket_number: string; subject: string; status: string; priority: string; created_at: string; due_date: string | null }

export default function ServiceDetail() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const { canEdit, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [schedule, setSchedule] = useState<ServiceScheduleRow | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [agreement, setAgreement] = useState<{ contract_number: string; title: string } | null>(null);
  const [targetLabel, setTargetLabel] = useState("");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!scheduleId) return;
    setLoading(true);
    const { data: s } = await supabase.from("service_schedules").select("*").eq("id", scheduleId).maybeSingle();
    const sched = (s ?? null) as ServiceScheduleRow | null;
    setSchedule(sched);
    if (!sched) { setLoading(false); return; }

    const [vRes, aRes, evRes, tRes] = await Promise.all([
      supabase.from("vendors").select("id, legal_name, display_name, vendor_number").eq("id", sched.vendor_id).maybeSingle(),
      sched.service_agreement_id
        ? supabase.from("contracts").select("contract_number, title").eq("id", sched.service_agreement_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("service_schedule_events").select("*").eq("schedule_id", scheduleId).order("created_at", { ascending: false }).limit(100),
      supabase.from("tickets").select("id, ticket_number, subject, status, priority, created_at, due_date").eq("generated_by_schedule_id", scheduleId).order("created_at", { ascending: false }),
    ]);
    setVendor((vRes.data ?? null) as Vendor | null);
    setAgreement((aRes.data ?? null) as any);
    setEvents((evRes.data ?? []) as EventRow[]);
    setTickets((tRes.data ?? []) as TicketRow[]);

    if (sched.target_entity_type === "unit") {
      const { data: u } = await supabase.from("units").select("unit_number, buildings(name)").eq("id", sched.target_entity_id).maybeSingle();
      setTargetLabel(u ? `Unit ${(u as any).unit_number} · ${(u as any).buildings?.name ?? ""}` : "(deleted)");
    } else {
      const { data: b } = await supabase.from("buildings").select("name").eq("id", sched.target_entity_id).maybeSingle();
      setTargetLabel((b as any)?.name ?? "(deleted)");
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [scheduleId]);

  const logEvent = async (event_type: string, description: string, from_value?: string, to_value?: string) => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("service_schedule_events").insert({
      schedule_id: scheduleId!, event_type, description,
      from_value: from_value ?? null, to_value: to_value ?? null,
      actor_id: u.user?.id ?? null,
    });
  };

  const handlePause = async () => {
    if (!schedule) return;
    setBusy(true);
    const { error } = await supabase.from("service_schedules").update({
      status: "paused", paused_at: new Date().toISOString(),
      paused_reason: reason.trim() || null, updated_at: new Date().toISOString(),
    }).eq("id", schedule.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await logEvent("paused", reason.trim() ? `Paused: ${reason.trim()}` : "Paused");
    toast.success("Schedule paused.");
    setPauseOpen(false); setReason(""); load();
  };

  const handleResume = async () => {
    if (!schedule) return;
    setBusy(true);
    const { error } = await supabase.from("service_schedules").update({
      status: "active", paused_at: null, paused_reason: null,
      updated_at: new Date().toISOString(),
    }).eq("id", schedule.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await logEvent("resumed", "Resumed");
    toast.success("Schedule resumed.");
    setResumeOpen(false); load();
  };

  const handleEnd = async () => {
    if (!schedule) return;
    if (!reason.trim()) { toast.error("A reason is required."); return; }
    setBusy(true);
    const today = new Date().toISOString().slice(0, 10);
    const newEnd = schedule.end_date && schedule.end_date < today ? schedule.end_date : today;
    const { error } = await supabase.from("service_schedules").update({
      status: "ended", ended_at: new Date().toISOString(),
      end_date: newEnd, updated_at: new Date().toISOString(),
    }).eq("id", schedule.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await logEvent("ended", `Ended: ${reason.trim()}`);
    toast.success("Schedule ended.");
    setEndOpen(false); setReason(""); load();
  };

  const handleDelete = async () => {
    if (!schedule || confirmName !== schedule.name) return;
    setBusy(true);
    const { error } = await supabase.from("service_schedules").delete().eq("id", schedule.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Schedule deleted. Generated tickets preserved.");
    navigate("/services");
  };

  if (loading) return <div className="flex items-center gap-2 py-24 justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!schedule) {
    return <EmptyState title="Schedule not found" description="It may have been deleted." action={<Button onClick={() => navigate("/services")}>Back to services</Button>} />;
  }

  const urgency = getScheduleUrgency(schedule.next_due_date, schedule.lead_time_days);
  const targetHref = schedule.target_entity_type === "unit"
    ? `/properties` // best-effort; full path requires building id in label
    : `/properties/${schedule.target_entity_id}`;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 mono text-[11px] uppercase tracking-wider text-muted-foreground">
        <Link to="/" className="hover:text-architect">Home</Link>
        <span>/</span>
        <Link to="/services" className="hover:text-architect">Services</Link>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="label-eyebrow text-true-taupe">Service schedule</div>
        <h1 className="font-display text-4xl text-architect leading-tight">{schedule.name}</h1>
        <div className="text-sm text-muted-foreground">
          {FREQUENCY_LABELS[schedule.frequency]} · {targetLabel} · {vendor?.display_name || vendor?.legal_name || "—"}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 pb-6 border-b hairline">
        {canEdit && (
          <>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            {schedule.status === "active" && (
              <Button variant="outline" size="sm" onClick={() => setPauseOpen(true)}>
                <Pause className="h-3.5 w-3.5" /> Pause
              </Button>
            )}
            {schedule.status === "paused" && (
              <Button variant="outline" size="sm" onClick={() => setResumeOpen(true)}>
                <Play className="h-3.5 w-3.5" /> Resume
              </Button>
            )}
            {schedule.status !== "ended" && (
              <Button variant="outline" size="sm" onClick={() => setEndOpen(true)}>
                <StopCircle className="h-3.5 w-3.5" /> End schedule
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </>
        )}
        <Button variant="ghost" size="sm" onClick={() => navigate("/services")} className="ml-auto">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard label="Status">
          <span className={cn("inline-block px-1.5 py-0.5 border rounded-sm text-[10px] uppercase tracking-wider", STATUS_STYLES[schedule.status])}>
            {STATUS_LABELS[schedule.status]}
          </span>
          {schedule.status === "paused" && schedule.paused_reason && (
            <div className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{schedule.paused_reason}</div>
          )}
        </SummaryCard>
        <SummaryCard label="Next due">
          <div className="text-sm text-architect">{format(new Date(schedule.next_due_date + "T00:00:00"), "MMM d, yyyy")}</div>
          <div className={cn("text-[11px]", urgencyTone(urgency))}>{formatDueCountdown(schedule.next_due_date)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {schedule.last_triggered_at
              ? `Last triggered ${format(new Date(schedule.last_triggered_at), "MMM d, yyyy")}`
              : "Never triggered"}
          </div>
        </SummaryCard>
        <SummaryCard label="Frequency">
          <div className="text-sm text-architect">{FREQUENCY_LABELS[schedule.frequency]}</div>
          <div className="text-[11px] text-muted-foreground">{frequencyEveryPhrase(schedule.frequency)}</div>
        </SummaryCard>
        <SummaryCard label="Vendor">
          {vendor ? (
            <Link to={`/vendors/${vendor.id}`} className="text-sm text-architect hover:underline">
              {vendor.display_name || vendor.legal_name}
            </Link>
          ) : <span className="text-muted-foreground italic text-sm">—</span>}
        </SummaryCard>
        <SummaryCard label="Target">
          <Link to={targetHref} className="text-sm text-architect hover:underline">{targetLabel}</Link>
        </SummaryCard>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tickets">
            Generated Tickets {tickets.length > 0 && <span className="ml-1 text-muted-foreground">({tickets.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <Section title="Schedule">
            <Field label="Start date" value={format(new Date(schedule.start_date + "T00:00:00"), "MMM d, yyyy")} />
            <Field label="End date" value={schedule.end_date ? format(new Date(schedule.end_date + "T00:00:00"), "MMM d, yyyy") : "Ongoing"} />
            <Field label="Lead time" value={`${schedule.lead_time_days} days`} />
            <Field label="Description" value={schedule.description} />
          </Section>
          <Section title="Service Agreement">
            {agreement ? (
              <Link to={`/contracts/${schedule.service_agreement_id}`} className="text-architect hover:underline">
                <span className="mono">{agreement.contract_number}</span> · {agreement.title}
              </Link>
            ) : (
              <div className="text-sm text-muted-foreground italic">
                No service agreement linked. Consider linking for audit clarity.
              </div>
            )}
          </Section>
          <Section title="Ticket defaults">
            <Field label="Default ticket type" value={schedule.default_ticket_type} />
            <Field label="Default priority" value={schedule.default_priority} />
            <Field label="Auto-assign vendor" value={schedule.auto_assign_vendor ? "Yes" : "No"} />
            <Field label="Auto-init workflow" value={schedule.auto_init_workflow ? "Yes" : "No"} />
          </Section>
          {schedule.notes && (
            <Section title="Notes">
              <p className="text-sm text-architect whitespace-pre-wrap">{schedule.notes}</p>
            </Section>
          )}
        </TabsContent>

        <TabsContent value="tickets" className="mt-6">
          {tickets.length === 0 ? (
            <EmptyState
              title="No tickets generated yet"
              description="Tickets will appear here as the sweep runs."
            />
          ) : (
            <div className="border hairline rounded-sm overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b hairline text-left">
                  <tr>
                    <th className="px-4 py-3 label-eyebrow">TKT #</th>
                    <th className="px-4 py-3 label-eyebrow">Subject</th>
                    <th className="px-4 py-3 label-eyebrow">Status</th>
                    <th className="px-4 py-3 label-eyebrow">Priority</th>
                    <th className="px-4 py-3 label-eyebrow">Created</th>
                    <th className="px-4 py-3 label-eyebrow">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} className="border-b hairline last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/tickets/${t.id}`)}>
                      <td className="px-4 py-3 mono text-xs text-muted-foreground">{t.ticket_number}</td>
                      <td className="px-4 py-3 text-architect">{t.subject}</td>
                      <td className="px-4 py-3 text-xs">{t.status}</td>
                      <td className="px-4 py-3 text-xs">{t.priority}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{format(new Date(t.created_at), "MMM d")}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{t.due_date ? format(new Date(t.due_date + "T00:00:00"), "MMM d, yyyy") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {events.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">No history yet.</div>
          ) : (
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.id} className="border hairline rounded-sm bg-card px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs label-eyebrow">{e.event_type.replace(/_/g, " ")}</div>
                    <div className="text-[11px] text-muted-foreground">{format(new Date(e.created_at), "MMM d, yyyy · HH:mm")}</div>
                  </div>
                  {e.description && <div className="text-sm text-architect mt-1">{e.description}</div>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ServiceScheduleDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        schedule={schedule}
        onSaved={() => { setEditOpen(false); load(); }}
      />

      {/* Pause */}
      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause this schedule?</DialogTitle>
            <DialogDescription>No new tickets will be generated until resumed. Existing tickets are unaffected.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you pausing?" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={handlePause} disabled={busy}>{busy ? "Pausing…" : "Pause"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resume */}
      <Dialog open={resumeOpen} onOpenChange={setResumeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resume this schedule?</DialogTitle>
            <DialogDescription>Tickets will resume generating from the next due date.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResumeOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={handleResume} disabled={busy}>{busy ? "Resuming…" : "Resume"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End */}
      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End this schedule?</DialogTitle>
            <DialogDescription>No new tickets will be generated. Existing tickets are unaffected. You cannot resume an ended schedule.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason <span className="text-destructive">*</span></Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you ending this schedule?" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={handleEnd} disabled={busy || !reason.trim()}>
              {busy ? "Ending…" : "End schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteOpen} onOpenChange={(v) => { setDeleteOpen(v); if (!v) setConfirmName(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this schedule?</DialogTitle>
            <DialogDescription>
              Generated tickets will be preserved (the link to this schedule will be cleared). Type the schedule name to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Type <span className="mono">{schedule.name}</span> to confirm</Label>
            <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy || confirmName !== schedule.name}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border hairline rounded-sm bg-card p-4">
      <div className="label-eyebrow mb-2">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border hairline rounded-sm bg-card p-5 space-y-3">
      <div className="label-eyebrow">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline gap-3">
      <div className="label-eyebrow w-44 shrink-0">{label}</div>
      <div className="text-sm text-architect">{value || <span className="text-muted-foreground italic">—</span>}</div>
    </div>
  );
}