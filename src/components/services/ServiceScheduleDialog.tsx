import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FREQUENCIES, FREQUENCY_LABELS, type Frequency,
  type ServiceScheduleRow,
} from "@/lib/services";
import {
  TICKET_PRIORITIES, TICKET_PRIORITY_LABELS, type TicketPriority,
} from "@/lib/tickets";
import { cn } from "@/lib/utils";

const RECURRING_TICKET_TYPES = [
  "maintenance_ac",
  "maintenance_plumbing",
  "maintenance_electrical",
  "maintenance_appliance",
  "maintenance_structural",
  "maintenance_pest_control",
  "maintenance_other",
  "compliance_reminder",
  "other",
] as const;

const TYPE_LABELS: Record<(typeof RECURRING_TICKET_TYPES)[number], string> = {
  maintenance_ac: "Maintenance: AC",
  maintenance_plumbing: "Maintenance: Plumbing",
  maintenance_electrical: "Maintenance: Electrical",
  maintenance_appliance: "Maintenance: Appliance",
  maintenance_structural: "Maintenance: Structural",
  maintenance_pest_control: "Maintenance: Pest control",
  maintenance_other: "Maintenance: Other",
  compliance_reminder: "Compliance: Reminder",
  other: "Other",
};

interface VendorOpt { id: string; legal_name: string; display_name: string | null; vendor_number: string }
interface AgreementOpt {
  contract_id: string;
  contract_number: string;
  title: string;
  vendor_id: string;
  scope: string[];
}
interface BuildingOpt { id: string; name: string }
interface UnitOpt { id: string; unit_number: string; building_id: string; building_name: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schedule?: ServiceScheduleRow | null;
  prefillVendorId?: string;
  prefillAgreementContractId?: string;
  onSaved: (id: string) => void;
}

export function ServiceScheduleDialog({
  open, onOpenChange, schedule, prefillVendorId, prefillAgreementContractId, onSaved,
}: Props) {
  const isEdit = !!schedule;
  const [busy, setBusy] = useState(false);

  // Reference data
  const [vendors, setVendors] = useState<VendorOpt[]>([]);
  const [agreements, setAgreements] = useState<AgreementOpt[]>([]);
  const [buildings, setBuildings] = useState<BuildingOpt[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [agreementContractId, setAgreementContractId] = useState<string>("");
  const [vendorId, setVendorId] = useState<string>("");
  const [targetType, setTargetType] = useState<"unit" | "building">("unit");
  const [targetId, setTargetId] = useState<string>("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>("");
  const [leadTimeDays, setLeadTimeDays] = useState<number>(7);
  const [defaultTicketType, setDefaultTicketType] = useState<string>("maintenance_other");
  const [defaultPriority, setDefaultPriority] = useState<TicketPriority>("medium");
  const [autoAssignVendor, setAutoAssignVendor] = useState(true);
  const [autoInitWorkflow, setAutoInitWorkflow] = useState(true);
  const [notes, setNotes] = useState("");

  // Reset / seed when opening
  useEffect(() => {
    if (!open) return;
    void loadRefs();
    if (schedule) {
      setName(schedule.name);
      setDescription(schedule.description ?? "");
      setAgreementContractId(schedule.service_agreement_id ?? "");
      setVendorId(schedule.vendor_id);
      setTargetType(schedule.target_entity_type);
      setTargetId(schedule.target_entity_id);
      setFrequency(schedule.frequency);
      setStartDate(schedule.start_date);
      setEndDate(schedule.end_date ?? "");
      setLeadTimeDays(schedule.lead_time_days);
      setDefaultTicketType(schedule.default_ticket_type);
      setDefaultPriority(schedule.default_priority);
      setAutoAssignVendor(schedule.auto_assign_vendor);
      setAutoInitWorkflow(schedule.auto_init_workflow);
      setNotes(schedule.notes ?? "");
    } else {
      setName("");
      setDescription("");
      setAgreementContractId(prefillAgreementContractId ?? "");
      setVendorId(prefillVendorId ?? "");
      setTargetType("unit");
      setTargetId("");
      setFrequency("monthly");
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate("");
      setLeadTimeDays(7);
      setDefaultTicketType("maintenance_other");
      setDefaultPriority("medium");
      setAutoAssignVendor(true);
      setAutoInitWorkflow(true);
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schedule?.id, prefillVendorId, prefillAgreementContractId]);

  const loadRefs = async () => {
    const [vRes, aRes, bRes, uRes] = await Promise.all([
      supabase.from("vendors").select("id, legal_name, display_name, vendor_number").eq("status", "active").order("legal_name"),
      supabase
        .from("service_agreements")
        .select("contract_id, vendor_id, scope_of_services, contracts:contract_id(contract_number, title, status)")
        .order("created_at", { ascending: false }),
      supabase.from("buildings").select("id, name").order("name"),
      supabase
        .from("units")
        .select("id, unit_number, building_id, buildings:building_id(name)")
        .order("unit_number"),
    ]);
    setVendors((vRes.data ?? []) as VendorOpt[]);
    setAgreements(
      ((aRes.data ?? []) as any[])
        .filter((a) => a.contracts && a.contracts.status === "active")
        .map((a) => ({
          contract_id: a.contract_id,
          contract_number: a.contracts?.contract_number ?? "",
          title: a.contracts?.title ?? "",
          vendor_id: a.vendor_id,
          scope: Array.isArray(a.scope_of_services) ? a.scope_of_services : [],
        })),
    );
    setBuildings((bRes.data ?? []) as BuildingOpt[]);
    setUnits(
      ((uRes.data ?? []) as any[]).map((u) => ({
        id: u.id,
        unit_number: u.unit_number,
        building_id: u.building_id,
        building_name: u.buildings?.name ?? "",
      })),
    );
  };

  // When selecting an agreement, lock vendor to its vendor.
  const selectedAgreement = useMemo(
    () => agreements.find((a) => a.contract_id === agreementContractId) ?? null,
    [agreements, agreementContractId],
  );

  useEffect(() => {
    if (selectedAgreement) {
      setVendorId(selectedAgreement.vendor_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgreement?.contract_id]);

  const startDateLocked = isEdit && !!schedule?.last_triggered_at;

  const targetOptions = targetType === "unit" ? units : buildings;

  const valid =
    name.trim().length >= 2 &&
    !!vendorId &&
    !!targetId &&
    !!frequency &&
    !!startDate &&
    !!defaultTicketType &&
    leadTimeDays >= 0 && leadTimeDays <= 90 &&
    (!endDate || endDate > startDate);

  const handleSubmit = async () => {
    if (!valid) { toast.error("Please complete all required fields."); return; }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        service_agreement_id: agreementContractId || null,
        vendor_id: vendorId,
        target_entity_type: targetType,
        target_entity_id: targetId,
        frequency,
        start_date: startDate,
        end_date: endDate || null,
        lead_time_days: leadTimeDays,
        default_ticket_type: defaultTicketType,
        default_priority: defaultPriority,
        auto_assign_vendor: autoAssignVendor,
        auto_init_workflow: autoAssignVendor ? autoInitWorkflow : false,
        notes: notes.trim() || null,
      };

      let savedId: string;
      if (isEdit && schedule) {
        // Don't change next_due_date on frequency edit. Only update start_date if not locked.
        const { start_date, ...rest } = payload;
        const updatePayload = startDateLocked
          ? { ...rest, updated_at: new Date().toISOString() }
          : { ...payload, updated_at: new Date().toISOString() };
        const { error } = await supabase
          .from("service_schedules")
          .update(updatePayload)
          .eq("id", schedule.id);
        if (error) throw error;
        savedId = schedule.id;
      } else {
        const insert = {
          ...payload,
          next_due_date: startDate,
          status: "active",
          created_by: u.user?.id ?? null,
        };
        const { data, error } = await supabase
          .from("service_schedules")
          .insert(insert)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        savedId = data!.id;
        // Log creation event
        await supabase.from("service_schedule_events").insert({
          schedule_id: savedId,
          event_type: "created",
          actor_id: u.user?.id ?? null,
          description: `Created schedule "${payload.name}"`,
        });
      }

      toast.success(isEdit ? "Schedule updated." : "Service schedule created.");
      onSaved(savedId);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save schedule.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit service schedule" : "New service schedule"}</DialogTitle>
          <DialogDescription>
            Recurring services automatically generate tickets on a fixed cadence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Basics */}
          <Section title="Basics">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 200))}
                placeholder="e.g. Monthly pest control — Building X"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this schedule covers (visible inside generated tickets)"
                className="min-h-[60px]"
              />
            </div>
          </Section>

          {/* Agreement */}
          <Section title="Service agreement (optional)">
            <div className="space-y-1.5">
              <Label>Linked agreement</Label>
              <Select value={agreementContractId || "none"} onValueChange={(v) => setAgreementContractId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="None — informal arrangement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None — informal arrangement</SelectItem>
                  {agreements.map((a) => (
                    <SelectItem key={a.contract_id} value={a.contract_id}>
                      {a.contract_number} · {a.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Link to a service agreement that authorizes this work. Recommended for audit clarity.
              </p>
              {selectedAgreement && selectedAgreement.scope.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {selectedAgreement.scope.map((s) => (
                    <span key={s} className="px-1.5 py-0.5 rounded-sm bg-muted/40 text-[10px] text-architect">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* Vendor */}
          <Section title="Vendor">
            <div className="space-y-1.5">
              <Label>Vendor <span className="text-destructive">*</span></Label>
              <Select
                value={vendorId}
                onValueChange={setVendorId}
                disabled={!!selectedAgreement}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor…" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.display_name || v.legal_name} · <span className="text-muted-foreground">{v.vendor_number}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAgreement && (
                <p className="text-xs text-muted-foreground">
                  Vendor inherited from the linked agreement. Clear the agreement to change vendor.
                </p>
              )}
            </div>
          </Section>

          {/* Target */}
          <Section title="Target">
            <div className="space-y-1.5">
              <Label>Target type <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                {(["unit", "building"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setTargetType(t); setTargetId(""); }}
                    className={cn(
                      "px-3 py-1.5 rounded-sm border text-xs uppercase tracking-wider",
                      targetType === t
                        ? "bg-architect text-chalk border-architect"
                        : "bg-card border-warm-stone text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {t === "unit" ? "Unit" : "Building"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Target {targetType} <span className="text-destructive">*</span></Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${targetType}…`} />
                </SelectTrigger>
                <SelectContent>
                  {targetType === "unit"
                    ? units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.building_name} · {u.unit_number}
                        </SelectItem>
                      ))
                    : buildings.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                </SelectContent>
              </Select>
              {targetOptions.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No {targetType}s available.</p>
              )}
            </div>
          </Section>

          {/* Schedule */}
          <Section title="Schedule">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Frequency <span className="text-destructive">*</span></Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>{FREQUENCY_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isEdit && schedule && schedule.frequency !== frequency && (
                  <p className="text-xs text-amber-700">
                    Frequency change applies from the next cycle onwards.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  Start date <span className="text-destructive">*</span>
                  {startDateLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={startDateLocked}
                />
                {startDateLocked && (
                  <p className="text-[11px] text-muted-foreground">Locked — tickets have already been generated.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                <p className="text-[11px] text-muted-foreground">Leave blank for ongoing.</p>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Lead time (days) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  max={90}
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(Math.max(0, Math.min(90, parseInt(e.target.value || "0", 10))))}
                />
                <p className="text-[11px] text-muted-foreground">
                  How many days before the next due date a ticket should be generated.
                </p>
              </div>
            </div>
          </Section>

          {/* Ticket defaults */}
          <Section title="Ticket defaults">
            <div className="space-y-1.5">
              <Label>Default ticket type <span className="text-destructive">*</span></Label>
              <Select value={defaultTicketType} onValueChange={setDefaultTicketType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECURRING_TICKET_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default priority <span className="text-destructive">*</span></Label>
              <div className="flex gap-1">
                {TICKET_PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDefaultPriority(p)}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-sm border text-xs uppercase tracking-wider",
                      defaultPriority === p
                        ? "bg-architect text-chalk border-architect"
                        : "bg-card border-warm-stone text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {TICKET_PRIORITY_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border hairline rounded-sm px-3 py-2">
              <div>
                <Label className="cursor-pointer">Auto-assign vendor</Label>
                <p className="text-[11px] text-muted-foreground">Generated tickets get the vendor assigned automatically.</p>
              </div>
              <Switch checked={autoAssignVendor} onCheckedChange={setAutoAssignVendor} />
            </div>
            {autoAssignVendor && (
              <div className="flex items-center justify-between gap-3 border hairline rounded-sm px-3 py-2">
                <div>
                  <Label className="cursor-pointer">Auto-initialize workflow</Label>
                  <p className="text-[11px] text-muted-foreground">Spin up the Vendor Dispatch workflow on each generated ticket.</p>
                </div>
                <Switch checked={autoInitWorkflow} onCheckedChange={setAutoInitWorkflow} />
              </div>
            )}
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes (not shown on tickets)"
              className="min-h-[60px]"
            />
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy || !valid}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="label-eyebrow">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}