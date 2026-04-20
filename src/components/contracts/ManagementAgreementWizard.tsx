import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Building2, Loader2, Pencil } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { PersonCombobox, type PickedPerson } from "@/components/owners/PersonCombobox";
import { SubjectPicker, type PickedSubject } from "./SubjectPicker";
import {
  FEE_MODELS, FEE_MODEL_LABELS, type FeeModel,
  SCOPE_OF_SERVICES, SCOPE_LABELS, type ScopeService,
} from "@/lib/contracts";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When provided, the wizard runs in edit mode against this contract id. */
  editContractId?: string;
  /** Called after a successful create or save. Receives the contract id. */
  onSaved?: (contractId: string) => void;
}

interface SelfPerson {
  id: string;
  company: string | null;
  first_name: string;
  authorized_signatory_name: string | null;
}

interface AdditionalSignatory {
  person: PickedPerson | null;
  role: "witness" | "guarantor" | "other";
}

interface FormState {
  // Step 1
  landlord: PickedPerson | null;
  additionalSignatories: AdditionalSignatory[];
  title: string;
  externalReference: string;
  startDate: string;
  endDate: string;
  durationPreset: "1y" | "2y" | "3y" | "custom";
  autoRenew: boolean;
  terminationNoticeDays: number;
  // Step 2
  subjects: PickedSubject[];
  // Step 3
  feeModel: FeeModel;
  feeValue: string;
  feeAppliesTo: "contracted_rent" | "collected_rent";
  hybridBaseFlat: string;
  hybridThreshold: string;
  hybridOveragePct: string;
  hasLeaseUpFee: boolean;
  leaseUpModel: "percentage" | "flat";
  leaseUpValue: string;
  repairThreshold: string;
  scope: ScopeService[];
  scopeOther: string;
  // Step 4
  notes: string;
  pendingFiles: File[];
  status: "draft" | "pending_signature" | "active";
}

const STEPS = [
  { key: 1, label: "Parties & period" },
  { key: 2, label: "Properties" },
  { key: 3, label: "Fee & scope" },
  { key: 4, label: "Review & save" },
] as const;

function todayISO() { return new Date().toISOString().slice(0, 10); }
function addYears(iso: string, years: number) {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function ManagementAgreementWizard({ open, onOpenChange, editContractId, onSaved }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [self, setSelf] = useState<SelfPerson | null>(null);
  const [selfLoading, setSelfLoading] = useState(true);
  const [confirmActiveEditOpen, setConfirmActiveEditOpen] = useState(false);
  const [originalSnapshot, setOriginalSnapshot] = useState<{
    status: string;
    feeModel: string;
    feeValue: number;
    startDate: string | null;
    endDate: string | null;
  } | null>(null);

  const isEdit = !!editContractId;

  const [form, setForm] = useState<FormState>(() => ({
    landlord: null,
    additionalSignatories: [],
    title: "",
    externalReference: "",
    startDate: todayISO(),
    endDate: addYears(todayISO(), 1),
    durationPreset: "1y",
    autoRenew: false,
    terminationNoticeDays: 60,
    subjects: [],
    feeModel: "percentage_of_rent",
    feeValue: "5",
    feeAppliesTo: "contracted_rent",
    hybridBaseFlat: "",
    hybridThreshold: "",
    hybridOveragePct: "",
    hasLeaseUpFee: false,
    leaseUpModel: "percentage",
    leaseUpValue: "",
    repairThreshold: "500",
    scope: ["rent_collection", "maintenance_minor", "financial_reporting"],
    scopeOther: "",
    notes: "",
    pendingFiles: [],
    status: "active",
  }));

  // Load self person info on open
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSelfLoading(true);
    (async () => {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("self_person_id")
        .maybeSingle();
      if (!settings?.self_person_id) {
        setSelfLoading(false);
        return;
      }
      const { data: p } = await supabase
        .from("people")
        .select("id, company, first_name, authorized_signatory_name")
        .eq("id", settings.self_person_id)
        .maybeSingle();
      setSelf(p as SelfPerson | null);
      setSelfLoading(false);
    })();
  }, [open]);

  // Pre-fill in edit mode
  useEffect(() => {
    if (!open || !editContractId) return;
    (async () => {
      const [cRes, maRes, pRes, sRes] = await Promise.all([
        supabase.from("contracts").select("*").eq("id", editContractId).maybeSingle(),
        supabase.from("management_agreements").select("*").eq("contract_id", editContractId).maybeSingle(),
        supabase
          .from("contract_parties")
          .select("id, person_id, role, is_signatory, people(id, first_name, last_name, company)")
          .eq("contract_id", editContractId),
        supabase
          .from("contract_subjects")
          .select("id, entity_type, entity_id")
          .eq("contract_id", editContractId),
      ]);
      const c = cRes.data as any;
      const ma = maRes.data as any;
      if (!c) return;

      // Find the landlord (role='client' or 'landlord' or 'lessor')
      const allParties = (pRes.data ?? []) as any[];
      const landlordRow =
        allParties.find((p) => ["client", "landlord", "lessor"].includes(p.role) && p.person_id !== self?.id) ??
        null;
      const landlord: PickedPerson | null = landlordRow
        ? {
            id: landlordRow.people.id,
            first_name: landlordRow.people.first_name,
            last_name: landlordRow.people.last_name,
            company: landlordRow.people.company,
          }
        : null;

      const additionalSignatories: AdditionalSignatory[] = allParties
        .filter(
          (p) =>
            !["service_provider", "client", "landlord", "lessor"].includes(p.role) &&
            p.person_id !== self?.id,
        )
        .map((p) => ({
          person: {
            id: p.people.id,
            first_name: p.people.first_name,
            last_name: p.people.last_name,
            company: p.people.company,
          },
          role: (["witness", "guarantor"].includes(p.role) ? p.role : "other") as AdditionalSignatory["role"],
        }));

      // Resolve subject labels
      const subjList = (sRes.data ?? []) as any[];
      const buildingIds = subjList.filter((s) => s.entity_type === "building").map((s) => s.entity_id);
      const unitIds = subjList.filter((s) => s.entity_type === "unit").map((s) => s.entity_id);
      const [bRes, uRes] = await Promise.all([
        buildingIds.length
          ? supabase.from("buildings").select("id, name").in("id", buildingIds)
          : Promise.resolve({ data: [] as any[] }),
        unitIds.length
          ? supabase.from("units").select("id, unit_number, building_id, buildings(name)").in("id", unitIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const bMap = new Map<string, string>();
      ((bRes.data ?? []) as any[]).forEach((b) => bMap.set(b.id, b.name));
      const uMap = new Map<string, { label: string; building_name: string }>();
      ((uRes.data ?? []) as any[]).forEach((u) =>
        uMap.set(u.id, {
          label: `${u.buildings?.name ?? ""} · ${u.unit_number}`,
          building_name: u.buildings?.name ?? "",
        }),
      );
      const subjects: PickedSubject[] = subjList.map((s) => ({
        entity_type: s.entity_type,
        entity_id: s.entity_id,
        label:
          s.entity_type === "building"
            ? bMap.get(s.entity_id) ?? "(deleted)"
            : uMap.get(s.entity_id)?.label ?? "(deleted)",
        building_name: s.entity_type === "unit" ? uMap.get(s.entity_id)?.building_name : undefined,
      }));

      setForm({
        landlord,
        additionalSignatories,
        title: c.title ?? "",
        externalReference: c.external_reference ?? "",
        startDate: c.start_date ?? todayISO(),
        endDate: c.end_date ?? addYears(todayISO(), 1),
        durationPreset: "custom",
        autoRenew: !!c.auto_renew,
        terminationNoticeDays: ma?.termination_notice_days ?? 60,
        subjects,
        feeModel: (ma?.fee_model ?? "percentage_of_rent") as FeeModel,
        feeValue: String(ma?.fee_value ?? "5"),
        feeAppliesTo: (ma?.fee_applies_to ?? "contracted_rent") as any,
        hybridBaseFlat: ma?.hybrid_base_flat != null ? String(ma.hybrid_base_flat) : "",
        hybridThreshold: ma?.hybrid_threshold != null ? String(ma.hybrid_threshold) : "",
        hybridOveragePct: ma?.hybrid_overage_percentage != null ? String(ma.hybrid_overage_percentage) : "",
        hasLeaseUpFee: ma?.lease_up_fee_model && ma.lease_up_fee_model !== "none",
        leaseUpModel: (ma?.lease_up_fee_model === "flat" ? "flat" : "percentage") as any,
        leaseUpValue: ma?.lease_up_fee_value != null ? String(ma.lease_up_fee_value) : "",
        repairThreshold: ma?.repair_approval_threshold != null ? String(ma.repair_approval_threshold) : "500",
        scope: (ma?.scope_of_services ?? []) as ScopeService[],
        scopeOther: ma?.scope_of_services_other ?? "",
        notes: c.notes ?? "",
        pendingFiles: [],
        status: c.status,
      });

      setOriginalSnapshot({
        status: c.status,
        feeModel: ma?.fee_model ?? "",
        feeValue: Number(ma?.fee_value ?? 0),
        startDate: c.start_date,
        endDate: c.end_date,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editContractId, self?.id]);

  // Auto-update title when landlord changes
  useEffect(() => {
    if (!form.landlord) return;
    const name = form.landlord.company || `${form.landlord.first_name} ${form.landlord.last_name}`.trim();
    if (!form.title || form.title.startsWith("Management Agreement —")) {
      setForm((s) => ({ ...s, title: `Management Agreement — ${name}` }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.landlord]);

  // Auto-update end date based on preset
  useEffect(() => {
    if (form.durationPreset === "custom") return;
    const yrs = form.durationPreset === "1y" ? 1 : form.durationPreset === "2y" ? 2 : 3;
    setForm((s) => ({ ...s, endDate: addYears(s.startDate, yrs) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.durationPreset, form.startDate]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  /* ===================== validation ===================== */
  const step1Valid =
    !!form.landlord &&
    !!form.title.trim() &&
    !!form.startDate &&
    !!form.endDate &&
    new Date(form.endDate) > new Date(form.startDate) &&
    Number.isFinite(Number(form.terminationNoticeDays)) &&
    Number(form.terminationNoticeDays) >= 0;

  const step2Valid = form.subjects.length > 0;

  const step3Valid = useMemo(() => {
    const fv = Number(form.feeValue);
    if (!Number.isFinite(fv) || fv <= 0) return false;
    if (form.feeModel === "percentage_of_rent") {
      if (fv > 100) return false;
      if (!form.feeAppliesTo) return false;
    }
    if (form.feeModel === "hybrid") {
      if (
        !Number.isFinite(Number(form.hybridBaseFlat)) || Number(form.hybridBaseFlat) <= 0 ||
        !Number.isFinite(Number(form.hybridThreshold)) || Number(form.hybridThreshold) <= 0 ||
        !Number.isFinite(Number(form.hybridOveragePct)) || Number(form.hybridOveragePct) <= 0
      ) return false;
    }
    if (form.scope.length === 0) return false;
    return true;
  }, [form]);

  const canProceed = step === 1 ? step1Valid : step === 2 ? step2Valid : step === 3 ? step3Valid : true;

  /* ===================== save ===================== */
  const handleSave = async () => {
    if (!self) {
      toast.error("Set up your company profile first.");
      return;
    }
    if (!step1Valid || !step2Valid || !step3Valid) {
      toast.error("Please complete all required fields before saving.");
      return;
    }
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();

    // Generate contract number
    const year = new Date().getFullYear();
    const { data: settings } = await supabase
      .from("app_settings")
      .select("contract_number_prefix, default_currency")
      .maybeSingle();
    const prefix = settings?.contract_number_prefix ?? "CTR";
    const currency = settings?.default_currency ?? "AED";

    const { data: numberResult, error: numErr } = await supabase.rpc("next_number", {
      p_prefix: prefix,
      p_year: year,
    });
    if (numErr || !numberResult) {
      setSubmitting(false);
      toast.error("Could not generate contract number.");
      return;
    }
    const contractNumber = numberResult as string;

    // Insert parent contract
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .insert({
        contract_type: "management_agreement",
        contract_number: contractNumber,
        external_reference: form.externalReference.trim() || null,
        title: form.title.trim(),
        status: form.status,
        start_date: form.startDate,
        end_date: form.endDate,
        auto_renew: form.autoRenew,
        currency,
        notes: form.notes.trim() || null,
        created_by: u.user?.id,
      })
      .select("id")
      .maybeSingle();
    if (cErr || !contract) {
      setSubmitting(false);
      toast.error(cErr?.message ?? "Could not create contract.");
      return;
    }
    const contractId = contract.id as string;

    // Insert child management_agreements row
    const maPayload: any = {
      contract_id: contractId,
      fee_model: form.feeModel,
      fee_value: Number(form.feeValue),
      fee_applies_to: form.feeModel === "percentage_of_rent" ? form.feeAppliesTo : null,
      lease_up_fee_model: form.hasLeaseUpFee ? form.leaseUpModel : "none",
      lease_up_fee_value: form.hasLeaseUpFee && form.leaseUpValue ? Number(form.leaseUpValue) : null,
      hybrid_base_flat: form.feeModel === "hybrid" ? Number(form.hybridBaseFlat) : null,
      hybrid_threshold: form.feeModel === "hybrid" ? Number(form.hybridThreshold) : null,
      hybrid_overage_percentage: form.feeModel === "hybrid" ? Number(form.hybridOveragePct) : null,
      repair_approval_threshold: form.repairThreshold ? Number(form.repairThreshold) : null,
      termination_notice_days: form.terminationNoticeDays,
      scope_of_services: form.scope,
      scope_of_services_other: form.scopeOther.trim() || null,
    };
    const { error: maErr } = await supabase.from("management_agreements").insert(maPayload);
    if (maErr) {
      // Roll back the parent
      await supabase.from("contracts").delete().eq("id", contractId);
      setSubmitting(false);
      toast.error(maErr.message);
      return;
    }

    // Insert parties: self (service_provider) + landlord (client) + extra signatories
    const partyRows = [
      { contract_id: contractId, person_id: self.id, role: "service_provider", is_signatory: true },
      { contract_id: contractId, person_id: form.landlord!.id, role: "client", is_signatory: true },
      ...form.additionalSignatories
        .filter((s) => !!s.person)
        .map((s) => ({
          contract_id: contractId,
          person_id: s.person!.id,
          role: s.role,
          is_signatory: true,
        })),
    ];
    const { error: pErr } = await supabase.from("contract_parties").insert(partyRows);
    if (pErr) {
      await supabase.from("contracts").delete().eq("id", contractId);
      setSubmitting(false);
      toast.error(pErr.message);
      return;
    }

    // Insert subjects
    const subjRows = form.subjects.map((s) => ({
      contract_id: contractId,
      entity_type: s.entity_type,
      entity_id: s.entity_id,
      role: "subject",
    }));
    const { error: sErr } = await supabase.from("contract_subjects").insert(subjRows);
    if (sErr) {
      await supabase.from("contracts").delete().eq("id", contractId);
      setSubmitting(false);
      toast.error(sErr.message);
      return;
    }

    // Log creation event
    await supabase.from("contract_events").insert({
      contract_id: contractId,
      event_type: "created",
      to_value: form.status,
      description: `Contract created (${form.status})`,
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

    setSubmitting(false);
    toast.success(`Contract ${contractNumber} created.`);
    onOpenChange(false);
    navigate(`/contracts/${contractId}`);
  };

  /* ===================== render ===================== */
  const landlordName = form.landlord
    ? form.landlord.company || `${form.landlord.first_name} ${form.landlord.last_name}`.trim()
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New Management Agreement</DialogTitle>
          <DialogDescription>
            Capture a landlord engagement: properties under management, fee structure, scope, and term.
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

        {selfLoading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !self ? (
          <div className="py-6 text-sm text-destructive">
            Set up your Company Profile in Settings before creating contracts.
          </div>
        ) : (
          <>
            {/* ===================== STEP 1 ===================== */}
            {step === 1 && (
              <div className="space-y-5 py-2">
                <div className="border hairline rounded-sm bg-warm-stone/20 p-3 flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-gold-deep" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <div className="label-eyebrow">PM Company</div>
                    <div className="text-sm text-architect truncate">
                      {self.company ?? self.first_name}
                    </div>
                    {self.authorized_signatory_name && (
                      <div className="text-[11px] text-muted-foreground">
                        Signed by {self.authorized_signatory_name}
                      </div>
                    )}
                  </div>
                  <Link
                    to="/settings"
                    className="text-xs text-true-taupe hover:text-architect inline-flex items-center gap-1"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </Link>
                </div>

                <div className="space-y-1.5">
                  <Label className="label-eyebrow">Landlord *</Label>
                  <PersonCombobox
                    value={form.landlord?.id ?? ""}
                    valueLabel={landlordName ?? ""}
                    onChange={(p) => update("landlord", p)}
                    placeholder="Search or add the landlord…"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="label-eyebrow">Title *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                    placeholder="Management Agreement — …"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="label-eyebrow">External reference</Label>
                  <Input
                    value={form.externalReference}
                    onChange={(e) => update("externalReference", e.target.value)}
                    placeholder="Landlord's internal contract number, optional"
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
                        <SelectItem value="1y">1 year</SelectItem>
                        <SelectItem value="2y">2 years</SelectItem>
                        <SelectItem value="3y">3 years</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between border hairline rounded-sm p-3 bg-card">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-architect">Auto-renew</Label>
                    <p className="text-[11px] text-muted-foreground">
                      If on, the contract automatically extends by the same duration on expiry unless terminated.
                    </p>
                  </div>
                  <Switch
                    checked={form.autoRenew}
                    onCheckedChange={(v) => update("autoRenew", v)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="label-eyebrow">Termination notice (days)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.terminationNoticeDays}
                    onChange={(e) => update("terminationNoticeDays", parseInt(e.target.value) || 0)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Days of notice either party must give to terminate before end date.
                  </p>
                </div>
              </div>
            )}

            {/* ===================== STEP 2 ===================== */}
            {step === 2 && (
              <div className="space-y-4 py-2">
                <div>
                  <h3 className="font-display text-lg text-architect">Properties Managed</h3>
                  <p className="text-sm text-muted-foreground">
                    Select the buildings or units this agreement authorizes you to manage.
                  </p>
                </div>
                <SubjectPicker
                  selected={form.subjects}
                  onChange={(s) => update("subjects", s)}
                  landlordPersonId={form.landlord?.id ?? null}
                  landlordName={landlordName}
                />
              </div>
            )}

            {/* ===================== STEP 3 ===================== */}
            {step === 3 && (
              <div className="space-y-5 py-2">
                <div className="space-y-1.5">
                  <Label className="label-eyebrow">Fee model *</Label>
                  <Select value={form.feeModel} onValueChange={(v) => update("feeModel", v as FeeModel)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FEE_MODELS.map((m) => (
                        <SelectItem key={m} value={m}>{FEE_MODEL_LABELS[m]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.feeModel === "percentage_of_rent" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="label-eyebrow">Fee percentage *</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={100}
                          value={form.feeValue}
                          onChange={(e) => update("feeValue", e.target.value)}
                          className="pr-8 text-right"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="label-eyebrow">Fee applies to *</Label>
                      <RadioGroup
                        value={form.feeAppliesTo}
                        onValueChange={(v) => update("feeAppliesTo", v as any)}
                        className="space-y-2"
                      >
                        <label className="flex items-start gap-3 border hairline rounded-sm p-3 cursor-pointer hover:bg-muted/30">
                          <RadioGroupItem value="contracted_rent" className="mt-0.5" />
                          <div>
                            <div className="text-sm text-architect font-medium">Contracted rent</div>
                            <div className="text-[11px] text-muted-foreground">
                              You earn the fee on lease value regardless of payment outcomes.
                            </div>
                          </div>
                        </label>
                        <label className="flex items-start gap-3 border hairline rounded-sm p-3 cursor-pointer hover:bg-muted/30">
                          <RadioGroupItem value="collected_rent" className="mt-0.5" />
                          <div>
                            <div className="text-sm text-architect font-medium">Collected rent</div>
                            <div className="text-[11px] text-muted-foreground">
                              You earn the fee only on rent actually collected.
                            </div>
                          </div>
                        </label>
                      </RadioGroup>
                    </div>
                  </>
                )}

                {form.feeModel === "flat_annual" && (
                  <div className="space-y-1.5">
                    <Label className="label-eyebrow">Fee amount * (AED / year)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.feeValue}
                      onChange={(e) => update("feeValue", e.target.value)}
                    />
                  </div>
                )}

                {form.feeModel === "flat_per_unit" && (
                  <div className="space-y-1.5">
                    <Label className="label-eyebrow">Fee per unit per year * (AED)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.feeValue}
                      onChange={(e) => update("feeValue", e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Estimated total: AED {(Number(form.feeValue) * form.subjects.length).toLocaleString()} / year
                    </p>
                  </div>
                )}

                {form.feeModel === "hybrid" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="label-eyebrow">Base flat / year *</Label>
                        <Input type="number" value={form.hybridBaseFlat} onChange={(e) => update("hybridBaseFlat", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="label-eyebrow">Threshold (AED) *</Label>
                        <Input type="number" value={form.hybridThreshold} onChange={(e) => update("hybridThreshold", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="label-eyebrow">Overage % *</Label>
                        <Input type="number" value={form.hybridOveragePct} onChange={(e) => update("hybridOveragePct", e.target.value)} />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      PM earns the flat base regardless. Above the threshold, PM also earns the percentage of the excess.
                    </p>
                    {/* fee_value carries the percentage portion for storage */}
                    <input type="hidden" value={form.hybridOveragePct} onChange={() => {}} />
                  </>
                )}

                {/* Lease-up fee */}
                <div className="border hairline rounded-sm p-3 bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm text-architect">Charge a lease-up fee</Label>
                      <p className="text-[11px] text-muted-foreground">
                        One-time fee when a new tenant is placed in a unit.
                      </p>
                    </div>
                    <Switch
                      checked={form.hasLeaseUpFee}
                      onCheckedChange={(v) => update("hasLeaseUpFee", v)}
                    />
                  </div>
                  {form.hasLeaseUpFee && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t hairline">
                      <div className="space-y-1.5">
                        <Label className="label-eyebrow">Model</Label>
                        <Select
                          value={form.leaseUpModel}
                          onValueChange={(v) => update("leaseUpModel", v as any)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage of annual rent</SelectItem>
                            <SelectItem value="flat">Flat AED</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="label-eyebrow">Value</Label>
                        <Input
                          type="number"
                          value={form.leaseUpValue}
                          onChange={(e) => update("leaseUpValue", e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="label-eyebrow">Repair approval threshold (AED)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.repairThreshold}
                    onChange={(e) => update("repairThreshold", e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Repairs under this amount can be actioned without landlord approval.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="label-eyebrow">Scope of services *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {SCOPE_OF_SERVICES.map((sv) => {
                      const checked = form.scope.includes(sv);
                      return (
                        <label
                          key={sv}
                          className="flex items-center gap-2 px-2.5 py-2 border hairline rounded-sm bg-card cursor-pointer hover:bg-muted/30"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() =>
                              update(
                                "scope",
                                checked ? form.scope.filter((s) => s !== sv) : [...form.scope, sv],
                              )
                            }
                          />
                          <span className="text-sm text-architect">{SCOPE_LABELS[sv]}</span>
                        </label>
                      );
                    })}
                  </div>
                  <Input
                    placeholder="Other services (comma-separated)"
                    value={form.scopeOther}
                    onChange={(e) => update("scopeOther", e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
            )}

            {/* ===================== STEP 4 ===================== */}
            {step === 4 && (
              <div className="space-y-5 py-2">
                <div className="space-y-1.5">
                  <Label className="label-eyebrow">Notes</Label>
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    placeholder="Internal notes about this agreement…"
                  />
                </div>

                <div className="border hairline rounded-sm bg-warm-stone/20 p-4 text-xs text-muted-foreground">
                  Document attachments can be uploaded from the contract detail page after creation.
                </div>

                {/* Review summary */}
                <div className="space-y-3 border hairline rounded-sm bg-card p-4">
                  <div className="label-eyebrow">Review</div>
                  <ReviewLine label="Landlord" value={landlordName ?? "—"} />
                  <ReviewLine label="Title" value={form.title} />
                  <ReviewLine
                    label="Period"
                    value={`${form.startDate} → ${form.endDate}${form.autoRenew ? " · auto-renew" : ""}`}
                  />
                  <ReviewLine label="Properties" value={`${form.subjects.length} subject(s)`} />
                  <ReviewLine label="Fee model" value={FEE_MODEL_LABELS[form.feeModel]} />
                  <ReviewLine
                    label="Fee value"
                    value={
                      form.feeModel === "percentage_of_rent"
                        ? `${form.feeValue}% (${form.feeAppliesTo})`
                        : form.feeModel === "hybrid"
                          ? `Base AED ${form.hybridBaseFlat} + ${form.hybridOveragePct}% over AED ${form.hybridThreshold}`
                          : `AED ${form.feeValue}`
                    }
                  />
                  <ReviewLine
                    label="Scope"
                    value={form.scope.length > 0 ? form.scope.map((s) => SCOPE_LABELS[s]).join(", ") : "—"}
                  />
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
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t hairline">
              <Button
                type="button"
                variant="ghost"
                onClick={() => (step === 1 ? onOpenChange(false) : setStep(step - 1))}
              >
                {step === 1 ? "Cancel" : (
                  <>
                    <ChevronLeft className="h-4 w-4" /> Back
                  </>
                )}
              </Button>
              {step < 4 ? (
                <Button
                  type="button"
                  variant="gold"
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed}
                >
                  Continue <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="gold"
                  onClick={handleSave}
                  disabled={submitting}
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                  ) : (
                    "Create contract"
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
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