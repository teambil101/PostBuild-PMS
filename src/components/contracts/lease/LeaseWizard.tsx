import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Home, Loader2, Plus, Trash2, RotateCcw, Building2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PersonCombobox, type PickedPerson } from "@/components/owners/PersonCombobox";
import {
  PAYMENT_FREQUENCIES, PAYMENT_FREQUENCY_LABELS, type PaymentFrequency,
  SECURITY_DEPOSIT_STATUSES, SECURITY_DEPOSIT_STATUS_LABELS, type SecurityDepositStatus,
  COMMISSION_PAYERS, COMMISSION_PAYER_LABELS, type CommissionPayer,
  COMMISSION_STATUSES, COMMISSION_STATUS_LABELS, type CommissionStatus,
  generateChequeSchedule, validateChequeSchedule, findOverlappingActiveLease,
  monthlyEquivalent, chequeCountForFrequency,
} from "@/lib/leases";
import { resolveUnitOwners } from "@/lib/ownership";
import { cn } from "@/lib/utils";

interface UnitOption {
  id: string;
  unit_number: string;
  unit_type: string;
  floor: number | null;
  building_id: string;
  building_name: string;
}

interface ChequeRow {
  sequence_number: number;
  amount: string;        // user-edited as string for cleaner inputs
  due_date: string;      // YYYY-MM-DD
  cheque_number: string;
  bank_name: string;
}

interface FormState {
  // Step 1
  unit: UnitOption | null;
  landlord: PickedPerson | null;
  tenant: PickedPerson | null;
  broker: PickedPerson | null;
  guarantor: PickedPerson | null;
  title: string;
  externalReference: string;
  startDate: string;
  endDate: string;
  durationPreset: "6m" | "12m" | "24m" | "custom";
  autoRenew: boolean;
  terminationNoticeDays: number;

  // Step 2
  annualRent: string;
  currency: string;
  paymentFrequency: PaymentFrequency;
  firstChequeDate: string;
  cheques: ChequeRow[];

  // Step 3
  depositAmount: string;
  depositStatus: SecurityDepositStatus;
  depositNotes: string;
  commissionAmount: string;
  commissionPayer: CommissionPayer;
  commissionStatus: CommissionStatus;

  // Step 4
  ejariNumber: string;
  notes: string;
  status: "draft" | "pending_signature" | "active";
}

const STEPS = [
  { key: 1, label: "Tenant & period" },
  { key: 2, label: "Rent & cheques" },
  { key: 3, label: "Deposit & fees" },
  { key: 4, label: "Review & save" },
] as const;

function todayISO() { return new Date().toISOString().slice(0, 10); }
function addMonths(iso: string, months: number) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  // Keep the lease ending the day before the anniversary, so a 12mo lease starting Jan 1 ends Dec 31.
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Pre-link a specific unit (entry from unit detail page). */
  initialUnitId?: string;
  /** Skip the precondition; the gate has already been shown and overridden. */
  loggedMissingMgmt?: boolean;
  onSaved?: (contractId: string) => void;
}

export function LeaseWizard({ open, onOpenChange, initialUnitId, loggedMissingMgmt, onSaved }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [defaultCurrency, setDefaultCurrency] = useState("AED");
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(() => ({
    unit: null,
    landlord: null,
    tenant: null,
    broker: null,
    guarantor: null,
    title: "",
    externalReference: "",
    startDate: todayISO(),
    endDate: addMonths(todayISO(), 12),
    durationPreset: "12m",
    autoRenew: false,
    terminationNoticeDays: 90,
    annualRent: "",
    currency: "AED",
    paymentFrequency: "4_cheques",
    firstChequeDate: todayISO(),
    cheques: [],
    depositAmount: "",
    depositStatus: "pending",
    depositNotes: "",
    commissionAmount: "",
    commissionPayer: "tenant",
    commissionStatus: "pending",
    ejariNumber: "",
    notes: "",
    status: "active",
  }));

  /* ====================== bootstrap on open ====================== */
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setStep1Error(null);
    setSaveError(null);

    (async () => {
      setUnitsLoading(true);
      const [settingsRes, unitsRes] = await Promise.all([
        supabase.from("app_settings").select("default_currency").maybeSingle(),
        supabase
          .from("units")
          .select("id, unit_number, unit_type, floor, building_id, buildings!inner(name)")
          .order("unit_number"),
      ]);
      const cur = settingsRes.data?.default_currency ?? "AED";
      setDefaultCurrency(cur);
      const list: UnitOption[] = ((unitsRes.data ?? []) as any[]).map((u) => ({
        id: u.id,
        unit_number: u.unit_number,
        unit_type: u.unit_type,
        floor: u.floor,
        building_id: u.building_id,
        building_name: u.buildings?.name ?? "—",
      }));
      setUnits(list);

      // If we have an initialUnitId, pre-link that unit and resolve landlord
      if (initialUnitId) {
        const u = list.find((x) => x.id === initialUnitId) ?? null;
        setForm((s) => ({ ...s, unit: u, currency: cur }));
      } else {
        setForm((s) => ({ ...s, currency: cur }));
      }
      setUnitsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialUnitId]);

  /* ====================== auto-derived fields ====================== */

  // Auto-fill landlord from unit ownership
  useEffect(() => {
    if (!form.unit) return;
    if (form.landlord) return; // don't overwrite user's manual pick
    (async () => {
      const owners = await resolveUnitOwners(form.unit!.id);
      if (owners.length === 0) return;
      const primary = owners.find((o) => o.is_primary) ?? owners[0];
      // Fetch the person details for the picker shape
      const { data: p } = await supabase
        .from("people")
        .select("id, first_name, last_name, company")
        .eq("id", primary.person_id)
        .maybeSingle();
      if (p) {
        setForm((s) => ({ ...s, landlord: p as PickedPerson }));
      }
    })();
  }, [form.unit, form.landlord]);

  // Auto-fill title from unit
  useEffect(() => {
    if (!form.unit) return;
    if (form.title.trim() && !form.title.startsWith("Lease — Unit ")) return;
    setForm((s) => ({
      ...s,
      title: `Lease — Unit ${form.unit!.unit_number}, ${form.unit!.building_name}`,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.unit]);

  // Update endDate when duration preset changes
  useEffect(() => {
    if (form.durationPreset === "custom") return;
    const m = form.durationPreset === "6m" ? 6 : form.durationPreset === "12m" ? 12 : 24;
    setForm((s) => ({ ...s, endDate: addMonths(s.startDate, m) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.durationPreset, form.startDate]);

  // Default firstChequeDate = startDate when start changes (only if user hasn't typed something different)
  useEffect(() => {
    setForm((s) => {
      if (s.firstChequeDate === todayISO() || !s.firstChequeDate) {
        return { ...s, firstChequeDate: s.startDate };
      }
      return s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startDate]);

  /* ====================== cheque schedule generation ====================== */

  const regenerateSchedule = (
    annualRent: number,
    frequency: PaymentFrequency,
    firstDate: string,
    startDate: string,
    endDate: string,
  ) => {
    if (frequency === "custom") {
      setForm((s) => ({ ...s, cheques: [] }));
      return;
    }
    const generated = generateChequeSchedule({
      frequency,
      annualRent,
      firstChequeDate: firstDate,
      startDate,
      endDate,
    });
    setForm((s) => ({
      ...s,
      cheques: generated.map((g) => ({
        sequence_number: g.sequence_number,
        amount: String(g.amount),
        due_date: g.due_date,
        cheque_number: "",
        bank_name: "",
      })),
    }));
  };

  // Auto-generate cheques when entering step 2 (if currently empty and frequency is fixed)
  useEffect(() => {
    if (step !== 2) return;
    if (form.cheques.length > 0) return;
    const rent = Number(form.annualRent);
    if (!Number.isFinite(rent) || rent <= 0) return;
    if (form.paymentFrequency === "custom") return;
    regenerateSchedule(rent, form.paymentFrequency, form.firstChequeDate, form.startDate, form.endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleFrequencyChange = (next: PaymentFrequency) => {
    setForm((s) => ({ ...s, paymentFrequency: next }));
    const rent = Number(form.annualRent);
    if (Number.isFinite(rent) && rent > 0) {
      regenerateSchedule(rent, next, form.firstChequeDate, form.startDate, form.endDate);
    } else if (next === "custom") {
      setForm((s) => ({ ...s, cheques: [] }));
    }
  };

  const handleResetSchedule = () => {
    const rent = Number(form.annualRent);
    if (!Number.isFinite(rent) || rent <= 0) {
      toast.error("Set the annual rent before resetting the schedule.");
      return;
    }
    regenerateSchedule(rent, form.paymentFrequency, form.firstChequeDate, form.startDate, form.endDate);
  };

  const updateChequeRow = (i: number, patch: Partial<ChequeRow>) => {
    setForm((s) => ({
      ...s,
      cheques: s.cheques.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }));
  };

  const removeChequeRow = (i: number) => {
    setForm((s) => ({
      ...s,
      cheques: s.cheques
        .filter((_, idx) => idx !== i)
        .map((c, idx) => ({ ...c, sequence_number: idx + 1 })),
    }));
  };

  const addChequeRow = () => {
    setForm((s) => ({
      ...s,
      cheques: [
        ...s.cheques,
        {
          sequence_number: s.cheques.length + 1,
          amount: "",
          due_date: "",
          cheque_number: "",
          bank_name: "",
        },
      ],
    }));
  };

  /* ====================== validation ====================== */

  const step1Valid =
    !!form.unit &&
    !!form.landlord &&
    !!form.tenant &&
    !!form.title.trim() &&
    !!form.startDate &&
    !!form.endDate &&
    new Date(form.endDate) > new Date(form.startDate);

  const chequeValidation = useMemo(() => {
    const rent = Number(form.annualRent);
    if (!Number.isFinite(rent) || rent <= 0) {
      return { ok: false, sumDelta: 0, errors: ["Annual rent must be greater than zero."], warnings: [] };
    }
    return validateChequeSchedule({
      cheques: form.cheques.map((c) => ({ amount: Number(c.amount) || 0, due_date: c.due_date })),
      annualRent: rent,
      startDate: form.startDate,
      endDate: form.endDate,
    });
  }, [form.cheques, form.annualRent, form.startDate, form.endDate]);

  const step2Valid = chequeValidation.ok;

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  /* ====================== overlap check on step 1 advance ====================== */

  const advanceFromStep1 = async () => {
    setStep1Error(null);
    if (!step1Valid || !form.unit) return;
    const conflict = await findOverlappingActiveLease({
      unitId: form.unit.id,
      startDate: form.startDate,
      endDate: form.endDate,
    });
    if (conflict) {
      setStep1Error(
        `This unit has an active lease (${conflict.contract_number}) from ${conflict.start_date} to ${conflict.end_date}. Resolve that lease before creating a new one.`,
      );
      return;
    }
    setStep(2);
  };

  /* ====================== save ====================== */

  const performSave = async () => {
    setSaveError(null);
    if (!step1Valid || !step2Valid || !form.unit) {
      toast.error("Please complete required fields before saving.");
      return;
    }
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();

    // Generate LSE number
    const year = new Date().getFullYear();
    const { data: numRes, error: numErr } = await supabase.rpc("next_number", {
      p_prefix: "LSE",
      p_year: year,
    });
    if (numErr || !numRes) {
      setSubmitting(false);
      toast.error("Could not generate lease number.");
      return;
    }
    const contractNumber = numRes as string;

    // Insert parent contract — always create as draft, then update to status if active
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .insert({
        contract_type: "lease",
        contract_number: contractNumber,
        external_reference: form.externalReference.trim() || null,
        title: form.title.trim(),
        status: "draft",
        start_date: form.startDate,
        end_date: form.endDate,
        auto_renew: form.autoRenew,
        currency: form.currency,
        notes: form.notes.trim() || null,
        created_by: u.user?.id,
      })
      .select("id")
      .maybeSingle();
    if (cErr || !contract) {
      setSubmitting(false);
      setSaveError(cErr?.message ?? "Could not create lease.");
      return;
    }
    const contractId = contract.id as string;

    const cleanup = async (msg: string) => {
      await supabase.from("contracts").delete().eq("id", contractId);
      setSubmitting(false);
      setSaveError(msg);
    };

    // Insert leases child
    const annualRent = Number(form.annualRent);
    const { error: lErr } = await supabase.from("leases").insert({
      contract_id: contractId,
      annual_rent: annualRent,
      payment_frequency: form.paymentFrequency,
      first_cheque_date: form.firstChequeDate || null,
      security_deposit_amount: form.depositAmount ? Number(form.depositAmount) : null,
      security_deposit_status: form.depositAmount ? form.depositStatus : null,
      security_deposit_notes: form.depositNotes.trim() || null,
      commission_amount: form.commissionAmount ? Number(form.commissionAmount) : null,
      commission_payer: form.commissionAmount ? form.commissionPayer : null,
      commission_status: form.commissionAmount ? form.commissionStatus : null,
      ejari_number: form.ejariNumber.trim() || null,
    });
    if (lErr) { await cleanup(lErr.message); return; }

    // Parties
    const parties: Array<{ contract_id: string; person_id: string; role: string; is_signatory: boolean }> = [
      { contract_id: contractId, person_id: form.landlord!.id, role: "landlord", is_signatory: true },
      { contract_id: contractId, person_id: form.tenant!.id, role: "tenant", is_signatory: true },
    ];
    if (form.broker) parties.push({ contract_id: contractId, person_id: form.broker.id, role: "broker", is_signatory: false });
    if (form.guarantor) parties.push({ contract_id: contractId, person_id: form.guarantor.id, role: "guarantor", is_signatory: true });
    const { error: pErr } = await supabase.from("contract_parties").insert(parties);
    if (pErr) { await cleanup(pErr.message); return; }

    // Subject (unit)
    const { error: sErr } = await supabase.from("contract_subjects").insert({
      contract_id: contractId,
      entity_type: "unit",
      entity_id: form.unit.id,
      role: "subject",
    });
    if (sErr) { await cleanup(sErr.message); return; }

    // Cheques
    if (form.cheques.length > 0) {
      // Need lease.id (not contract_id) to attach cheques
      const { data: leaseRow } = await supabase
        .from("leases")
        .select("id")
        .eq("contract_id", contractId)
        .maybeSingle();
      if (!leaseRow) { await cleanup("Could not load created lease."); return; }
      const leaseId = (leaseRow as any).id as string;
      const { error: cqErr } = await supabase.from("lease_cheques").insert(
        form.cheques.map((c) => ({
          lease_id: leaseId,
          sequence_number: c.sequence_number,
          amount: Number(c.amount),
          due_date: c.due_date,
          cheque_number: c.cheque_number.trim() || null,
          bank_name: c.bank_name.trim() || null,
          status: "pending",
        })),
      );
      if (cqErr) { await cleanup(cqErr.message); return; }
    }

    // Activate if requested — this fires the unit-status sync trigger AND the overlap trigger
    if (form.status === "active") {
      const { error: actErr } = await supabase
        .from("contracts")
        .update({ status: "active" })
        .eq("id", contractId);
      if (actErr) {
        // Likely the P0001 overlap trigger
        const friendly =
          actErr.code === "P0001" || /active lease/i.test(actErr.message)
            ? `Activation blocked: ${actErr.message}`
            : actErr.message;
        await cleanup(friendly);
        return;
      }
    } else if (form.status === "pending_signature") {
      await supabase
        .from("contracts")
        .update({ status: "pending_signature" })
        .eq("id", contractId);
    }

    // Events
    await supabase.from("contract_events").insert({
      contract_id: contractId,
      event_type: "created",
      to_value: form.status,
      description: `Lease created (${form.status})`,
      actor_id: u.user?.id,
    });
    if (form.status === "active") {
      await supabase.from("contract_events").insert({
        contract_id: contractId,
        event_type: "status_changed",
        from_value: "draft",
        to_value: "active",
        description: "Activated on creation",
        actor_id: u.user?.id,
      });
    }
    if (loggedMissingMgmt) {
      await supabase.from("contract_events").insert({
        contract_id: contractId,
        event_type: "note",
        description: "Created without an active management agreement covering this unit.",
        actor_id: u.user?.id,
      });
    }

    setSubmitting(false);
    toast.success(`Lease ${contractNumber} created.`);
    onOpenChange(false);
    onSaved?.(contractId);
    navigate(`/contracts/${contractId}`);
  };

  /* ====================== render ====================== */

  const tenantName = form.tenant
    ? form.tenant.company || `${form.tenant.first_name} ${form.tenant.last_name}`.trim()
    : null;
  const landlordName = form.landlord
    ? form.landlord.company || `${form.landlord.first_name} ${form.landlord.last_name}`.trim()
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New Lease</DialogTitle>
          <DialogDescription>
            Capture a tenant engagement: rent schedule, deposit, commission, and term.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 pb-4 border-b hairline">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1 flex-1">
              <div
                className={cn(
                  "flex items-center gap-2 px-2 py-1 rounded-sm text-xs",
                  step === s.key
                    ? "bg-architect text-chalk"
                    : step > s.key
                      ? "text-gold-deep"
                      : "text-muted-foreground",
                )}
              >
                <span className="mono text-[10px]">{s.key}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-warm-stone" />}
            </div>
          ))}
        </div>

        {unitsLoading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {/* ===================== STEP 1 ===================== */}
            {step === 1 && (
              <Step1
                form={form}
                update={update}
                units={units}
                lockedUnit={!!initialUnitId}
                tenantName={tenantName}
                landlordName={landlordName}
                error={step1Error}
              />
            )}

            {/* ===================== STEP 2 ===================== */}
            {step === 2 && (
              <Step2
                form={form}
                update={update}
                onFrequencyChange={handleFrequencyChange}
                onResetSchedule={handleResetSchedule}
                onUpdateRow={updateChequeRow}
                onRemoveRow={removeChequeRow}
                onAddRow={addChequeRow}
                validation={chequeValidation}
              />
            )}

            {/* ===================== STEP 3 ===================== */}
            {step === 3 && (
              <Step3 form={form} update={update} />
            )}

            {/* ===================== STEP 4 ===================== */}
            {step === 4 && (
              <Step4
                form={form}
                update={update}
                tenantName={tenantName}
                landlordName={landlordName}
                error={saveError}
              />
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t hairline">
              <Button
                type="button"
                variant="ghost"
                onClick={() => (step === 1 ? onOpenChange(false) : setStep(step - 1))}
              >
                {step === 1 ? "Cancel" : (<><ChevronLeft className="h-4 w-4" /> Back</>)}
              </Button>
              {step < 4 ? (
                <Button
                  type="button"
                  variant="gold"
                  onClick={() => {
                    if (step === 1) advanceFromStep1();
                    else if (step === 2 && step2Valid) setStep(3);
                    else if (step === 3) setStep(4);
                  }}
                  disabled={
                    (step === 1 && !step1Valid) ||
                    (step === 2 && !step2Valid)
                  }
                >
                  Continue <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="gold"
                  onClick={performSave}
                  disabled={submitting}
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                  ) : "Create lease"}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 * STEP 1 — Tenant, landlord, period
 * ============================================================ */
function Step1({
  form, update, units, lockedUnit, tenantName, landlordName, error,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  units: UnitOption[];
  lockedUnit: boolean;
  tenantName: string | null;
  landlordName: string | null;
  error: string | null;
}) {
  return (
    <div className="space-y-5 py-2">
      {/* Unit card */}
      {form.unit ? (
        <div className="border hairline rounded-sm bg-warm-stone/20 p-3 flex items-center gap-3">
          <Home className="h-5 w-5 text-gold-deep" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <div className="label-eyebrow">Unit</div>
            <div className="text-sm text-architect truncate">
              {form.unit.building_name} · Unit {form.unit.unit_number}
            </div>
            <div className="text-[11px] text-muted-foreground capitalize">
              {form.unit.unit_type.replace(/_/g, " ")}
              {form.unit.floor != null && ` · Floor ${form.unit.floor}`}
            </div>
          </div>
          {!lockedUnit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => update("unit", null)}
            >
              Change
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="label-eyebrow">Unit *</Label>
          <Select
            value=""
            onValueChange={(id) => {
              const u = units.find((x) => x.id === id);
              if (u) update("unit", u);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Search and select a unit…" />
            </SelectTrigger>
            <SelectContent>
              {units.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">
                  No units found. Create a building and unit first.
                </div>
              ) : (
                units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.building_name} · Unit {u.unit_number}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="label-eyebrow">Landlord *</Label>
        <PersonCombobox
          value={form.landlord?.id ?? ""}
          valueLabel={landlordName ?? ""}
          onChange={(p) => update("landlord", p)}
          placeholder="Auto-filled from unit ownership; change if needed…"
        />
        <p className="text-[11px] text-muted-foreground">
          Auto-populated from this unit's primary owner. Change if a different owner signs the lease.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="label-eyebrow">Tenant *</Label>
        <PersonCombobox
          value={form.tenant?.id ?? ""}
          valueLabel={tenantName ?? ""}
          onChange={(p) => update("tenant", p)}
          placeholder="Search or add the tenant…"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="label-eyebrow">Broker (optional)</Label>
          <PersonCombobox
            value={form.broker?.id ?? ""}
            valueLabel={form.broker ? (form.broker.company || `${form.broker.first_name} ${form.broker.last_name}`.trim()) : ""}
            onChange={(p) => update("broker", p)}
            placeholder="Search…"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="label-eyebrow">Guarantor (optional)</Label>
          <PersonCombobox
            value={form.guarantor?.id ?? ""}
            valueLabel={form.guarantor ? (form.guarantor.company || `${form.guarantor.first_name} ${form.guarantor.last_name}`.trim()) : ""}
            onChange={(p) => update("guarantor", p)}
            placeholder="Search…"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="label-eyebrow">Title *</Label>
        <Input
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="Lease — Unit …"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="label-eyebrow">External reference</Label>
        <Input
          value={form.externalReference}
          onChange={(e) => update("externalReference", e.target.value)}
          placeholder="Tenant or landlord's internal reference, optional"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="label-eyebrow">Start date *</Label>
          <Input
            type="date"
            value={form.startDate}
            onChange={(e) => update("startDate", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="label-eyebrow">End date *</Label>
          <Input
            type="date"
            value={form.endDate}
            onChange={(e) => {
              update("endDate", e.target.value);
              update("durationPreset", "custom");
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="label-eyebrow">Duration</Label>
          <Select
            value={form.durationPreset}
            onValueChange={(v) => update("durationPreset", v as any)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="6m">6 months</SelectItem>
              <SelectItem value="12m">12 months</SelectItem>
              <SelectItem value="24m">24 months</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between border hairline rounded-sm p-3 bg-card">
        <div className="space-y-0.5">
          <Label className="text-sm text-architect">Auto-renew</Label>
          <p className="text-[11px] text-muted-foreground">
            Most UAE leases renew through explicit renegotiation. Leave off unless your contract specifies auto-renewal.
          </p>
        </div>
        <Switch checked={form.autoRenew} onCheckedChange={(v) => update("autoRenew", v)} />
      </div>

      <div className="space-y-1.5">
        <Label className="label-eyebrow">Termination notice (days)</Label>
        <Input
          type="number"
          min={0}
          value={form.terminationNoticeDays}
          onChange={(e) => update("terminationNoticeDays", parseInt(e.target.value) || 0)}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 rounded-sm p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * STEP 2 — Rent & cheques
 * ============================================================ */
function Step2({
  form, update, onFrequencyChange, onResetSchedule, onUpdateRow, onRemoveRow, onAddRow, validation,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onFrequencyChange: (f: PaymentFrequency) => void;
  onResetSchedule: () => void;
  onUpdateRow: (i: number, patch: Partial<ChequeRow>) => void;
  onRemoveRow: (i: number) => void;
  onAddRow: () => void;
  validation: { ok: boolean; sumDelta: number; errors: string[]; warnings: string[] };
}) {
  const rent = Number(form.annualRent) || 0;
  const monthly = monthlyEquivalent(rent);
  const sum = form.cheques.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const sumPctOff = rent > 0 ? Math.abs(sum - rent) / rent : 0;
  const sumTone =
    sumPctOff <= 0.001 ? "ok" :
    sumPctOff <= 0.10  ? "warn" : "err";

  return (
    <div className="space-y-5 py-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="label-eyebrow">Annual rent *</Label>
          <div className="relative">
            <Input
              type="number"
              min={0}
              value={form.annualRent}
              onChange={(e) => update("annualRent", e.target.value)}
              className="pr-16 text-right mono"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              {form.currency}
            </span>
          </div>
          {rent > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Monthly equivalent: <span className="mono text-architect">{form.currency} {monthly.toLocaleString()}</span>
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="label-eyebrow">Currency</Label>
          <Select value={form.currency} onValueChange={(v) => update("currency", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["AED", "USD", "SAR", "EUR", "GBP"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="label-eyebrow">Payment frequency *</Label>
          <Select value={form.paymentFrequency} onValueChange={(v) => onFrequencyChange(v as PaymentFrequency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_FREQUENCIES.map((f) => (
                <SelectItem key={f} value={f}>{PAYMENT_FREQUENCY_LABELS[f]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="label-eyebrow">First cheque date *</Label>
          <Input
            type="date"
            value={form.firstChequeDate}
            onChange={(e) => {
              update("firstChequeDate", e.target.value);
              if (form.paymentFrequency !== "custom" && rent > 0) {
                // Re-generate when first date changes
                const fresh = generateChequeSchedule({
                  frequency: form.paymentFrequency,
                  annualRent: rent,
                  firstChequeDate: e.target.value,
                  startDate: form.startDate,
                  endDate: form.endDate,
                });
                update("cheques", fresh.map((g) => ({
                  sequence_number: g.sequence_number,
                  amount: String(g.amount),
                  due_date: g.due_date,
                  cheque_number: "",
                  bank_name: "",
                })));
              }
            }}
          />
        </div>
      </div>

      {/* Cheque schedule table */}
      <div className="border hairline rounded-sm bg-card overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b hairline bg-muted/30">
          <div className="label-eyebrow">Cheque schedule</div>
          <div className="flex items-center gap-2">
            {form.paymentFrequency !== "custom" && (
              <Button type="button" variant="ghost" size="sm" onClick={onResetSchedule}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            )}
            {form.paymentFrequency === "custom" && (
              <Button type="button" variant="outline" size="sm" onClick={onAddRow}>
                <Plus className="h-3.5 w-3.5" /> Add cheque
              </Button>
            )}
          </div>
        </div>
        {form.cheques.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {form.paymentFrequency === "custom"
              ? "Add cheques manually using the button above."
              : "Set the annual rent above to auto-generate the schedule."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 label-eyebrow w-10">#</th>
                <th className="px-3 py-2 label-eyebrow">Due date</th>
                <th className="px-3 py-2 label-eyebrow">Amount</th>
                <th className="px-3 py-2 label-eyebrow">Cheque #</th>
                <th className="px-3 py-2 label-eyebrow">Bank</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {form.cheques.map((c, i) => (
                <tr key={i} className="border-t hairline">
                  <td className="px-3 py-1.5 mono text-xs text-muted-foreground">{c.sequence_number}</td>
                  <td className="px-1.5 py-1">
                    <Input
                      type="date"
                      value={c.due_date}
                      onChange={(e) => onUpdateRow(i, { due_date: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <Input
                      type="number"
                      value={c.amount}
                      onChange={(e) => onUpdateRow(i, { amount: e.target.value })}
                      className="h-8 text-xs text-right mono"
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <Input
                      value={c.cheque_number}
                      onChange={(e) => onUpdateRow(i, { cheque_number: e.target.value })}
                      placeholder="optional"
                      className="h-8 text-xs mono"
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <Input
                      value={c.bank_name}
                      onChange={(e) => onUpdateRow(i, { bank_name: e.target.value })}
                      placeholder="optional"
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1">
                    {form.paymentFrequency === "custom" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onRemoveRow(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t hairline bg-muted/20">
                <td colSpan={2} className="px-3 py-2 text-xs label-eyebrow text-right">Total</td>
                <td className="px-3 py-2 text-right mono text-sm">
                  <span className={cn(
                    sumTone === "ok" && "text-status-occupied",
                    sumTone === "warn" && "text-amber-700",
                    sumTone === "err" && "text-destructive",
                  )}>
                    {form.currency} {sum.toLocaleString()}
                  </span>
                  {sumTone === "ok" && <CheckCircle2 className="inline h-3.5 w-3.5 ml-1 text-status-occupied" />}
                </td>
                <td colSpan={3} className="px-3 py-2 text-xs text-muted-foreground">
                  vs <span className="mono">{form.currency} {rent.toLocaleString()}</span> annual
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {validation.errors.length > 0 && (
        <div className="border border-destructive/40 bg-destructive/10 rounded-sm p-3 text-sm text-destructive space-y-1">
          {validation.errors.map((e, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{e}</span>
            </div>
          ))}
        </div>
      )}
      {validation.errors.length === 0 && validation.warnings.length > 0 && (
        <div className="border border-amber-500/40 bg-amber-500/10 rounded-sm p-3 text-sm text-amber-900 space-y-1">
          {validation.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-700" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * STEP 3 — Deposit & commission
 * ============================================================ */
function Step3({
  form, update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  const rent = Number(form.annualRent) || 0;
  return (
    <div className="space-y-6 py-2">
      {/* Security deposit */}
      <div className="space-y-3 border hairline rounded-sm p-4 bg-card">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-base text-architect">Security deposit</div>
            <p className="text-[11px] text-muted-foreground">Optional — leave blank if no deposit collected.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="label-eyebrow">Amount</Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                value={form.depositAmount}
                onChange={(e) => update("depositAmount", e.target.value)}
                className="pr-16 text-right mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                {form.currency}
              </span>
            </div>
            {rent > 0 && (
              <div className="flex items-center gap-1 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => update("depositAmount", String(Math.round(rent * 0.05)))}>
                  5% (unfurnished)
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => update("depositAmount", String(Math.round(rent * 0.10)))}>
                  10% (furnished)
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Status</Label>
            <Select value={form.depositStatus} onValueChange={(v) => update("depositStatus", v as SecurityDepositStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SECURITY_DEPOSIT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{SECURITY_DEPOSIT_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="label-eyebrow">Notes</Label>
          <Textarea
            rows={2}
            value={form.depositNotes}
            onChange={(e) => update("depositNotes", e.target.value)}
            placeholder="e.g. Cheque reference, bank, transfer date"
          />
        </div>
      </div>

      {/* Commission */}
      <div className="space-y-3 border hairline rounded-sm p-4 bg-card">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-base text-architect">Commission</div>
            <p className="text-[11px] text-muted-foreground">Optional — broker / lease-up fee.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="label-eyebrow">Amount</Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                value={form.commissionAmount}
                onChange={(e) => update("commissionAmount", e.target.value)}
                className="pr-16 text-right mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                {form.currency}
              </span>
            </div>
            {rent > 0 && (
              <div className="flex items-center gap-1 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => update("commissionAmount", String(Math.round(rent * 0.05)))}>
                  5% of rent
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Status</Label>
            <Select value={form.commissionStatus} onValueChange={(v) => update("commissionStatus", v as CommissionStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMMISSION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{COMMISSION_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="label-eyebrow">Payer</Label>
          <RadioGroup
            value={form.commissionPayer}
            onValueChange={(v) => update("commissionPayer", v as CommissionPayer)}
            className="flex flex-wrap gap-2"
          >
            {COMMISSION_PAYERS.map((p) => (
              <label key={p} className="flex items-center gap-2 border hairline rounded-sm px-3 py-2 cursor-pointer hover:bg-muted/30">
                <RadioGroupItem value={p} />
                <span className="text-sm text-architect">{COMMISSION_PAYER_LABELS[p]}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * STEP 4 — Documents, notes, review
 * ============================================================ */
function Step4({
  form, update, tenantName, landlordName, error,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  tenantName: string | null;
  landlordName: string | null;
  error: string | null;
}) {
  const rent = Number(form.annualRent) || 0;
  return (
    <div className="space-y-5 py-2">
      <div className="space-y-1.5">
        <Label className="label-eyebrow">Ejari number</Label>
        <Input
          value={form.ejariNumber}
          onChange={(e) => update("ejariNumber", e.target.value)}
          placeholder="Dubai Ejari registration number — can be added later"
          className="mono"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="label-eyebrow">Notes</Label>
        <Textarea
          rows={3}
          maxLength={2000}
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Internal notes about this lease…"
        />
      </div>

      <div className="border hairline rounded-sm bg-warm-stone/20 p-4 text-xs text-muted-foreground">
        Document attachments (signed lease, Ejari certificate, supporting docs) can be uploaded
        from the lease detail page after creation.
      </div>

      <div className="space-y-3 border hairline rounded-sm bg-card p-4">
        <div className="label-eyebrow">Review</div>
        <ReviewLine label="Unit" value={form.unit ? `${form.unit.building_name} · Unit ${form.unit.unit_number}` : "—"} />
        <ReviewLine label="Landlord" value={landlordName ?? "—"} />
        <ReviewLine label="Tenant" value={tenantName ?? "—"} />
        {form.broker && <ReviewLine label="Broker" value={form.broker.company || `${form.broker.first_name} ${form.broker.last_name}`} />}
        {form.guarantor && <ReviewLine label="Guarantor" value={form.guarantor.company || `${form.guarantor.first_name} ${form.guarantor.last_name}`} />}
        <ReviewLine label="Period" value={`${form.startDate} → ${form.endDate}${form.autoRenew ? " · auto-renew" : ""}`} />
        <ReviewLine label="Annual rent" value={`${form.currency} ${rent.toLocaleString()} (${form.currency} ${monthlyEquivalent(rent).toLocaleString()}/mo)`} />
        <ReviewLine label="Cheques" value={`${form.cheques.length} × ${PAYMENT_FREQUENCY_LABELS[form.paymentFrequency]}`} />
        {form.depositAmount && (
          <ReviewLine label="Security deposit" value={`${form.currency} ${Number(form.depositAmount).toLocaleString()} · ${SECURITY_DEPOSIT_STATUS_LABELS[form.depositStatus]}`} />
        )}
        {form.commissionAmount && (
          <ReviewLine label="Commission" value={`${form.currency} ${Number(form.commissionAmount).toLocaleString()} · ${COMMISSION_PAYER_LABELS[form.commissionPayer]} pays · ${COMMISSION_STATUS_LABELS[form.commissionStatus]}`} />
        )}
      </div>

      <div className="space-y-2">
        <Label className="label-eyebrow">Status on save</Label>
        <RadioGroup
          value={form.status}
          onValueChange={(v) => update("status", v as any)}
          className="space-y-2"
        >
          <label className="flex items-center gap-3 border hairline rounded-sm p-2.5 cursor-pointer hover:bg-muted/30">
            <RadioGroupItem value="draft" />
            <div className="text-sm text-architect">Save as draft</div>
          </label>
          <label className="flex items-center gap-3 border hairline rounded-sm p-2.5 cursor-pointer hover:bg-muted/30">
            <RadioGroupItem value="pending_signature" />
            <div className="text-sm text-architect">Pending signature</div>
          </label>
          <label className="flex items-center gap-3 border hairline rounded-sm p-2.5 cursor-pointer hover:bg-muted/30">
            <RadioGroupItem value="active" />
            <div className="text-sm text-architect">Create and activate</div>
          </label>
        </RadioGroup>
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 rounded-sm p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-architect text-right break-words">{value}</span>
    </div>
  );
}