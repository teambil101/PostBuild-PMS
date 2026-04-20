import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  ChevronLeft, ChevronRight, Building2, Loader2, Pencil, Briefcase, AlertTriangle,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { PersonCombobox, type PickedPerson } from "@/components/owners/PersonCombobox";
import { VendorPicker, type PickedVendor } from "@/components/vendors/VendorPicker";
import { SubjectPicker, type PickedSubject } from "../SubjectPicker";
import {
  SERVICE_FEE_MODELS, SERVICE_FEE_MODEL_LABELS, type ServiceFeeModel,
  SERVICE_FREQUENCIES, SERVICE_FREQUENCY_LABELS, type ServiceFrequency,
  SERVICE_SCOPES, SERVICE_SCOPE_LABELS, type ServiceScope,
  formatServiceFee,
} from "@/lib/contracts";
import { vendorDisplayName, parseSpecialties, SPECIALTY_LABELS } from "@/lib/vendors";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Edit mode against an existing contract id. */
  editContractId?: string;
  /** Optional pre-fill: jump-start with vendor and/or subjects. */
  presetVendorId?: string | null;
  presetSubjects?: PickedSubject[];
  onSaved?: (contractId: string) => void;
}

interface SelfPerson {
  id: string;
  company: string | null;
  first_name: string;
  authorized_signatory_name: string | null;
}

interface VendorContactRow {
  id: string;
  person_id: string;
  is_primary: boolean;
  role: string;
  people: { id: string; first_name: string; last_name: string; company: string | null } | null;
}

interface AdditionalSignatory {
  person: PickedPerson | null;
  role: "guarantor" | "other";
}

interface FormState {
  // Step 1
  vendor: PickedVendor | null;
  vendorSignatory: PickedPerson | null;
  additionalSignatories: AdditionalSignatory[];
  title: string;
  externalReference: string;
  startDate: string;
  endDate: string;
  durationPreset: "6m" | "1y" | "2y" | "custom";
  autoRenew: boolean;
  terminationNoticeDays: number;
  // Step 2
  subjects: PickedSubject[];
  // Step 3
  scope: ServiceScope[];
  scopeOther: string;
  serviceFrequency: ServiceFrequency;
  feeModel: ServiceFeeModel;
  feeValue: string;
  hybridBaseMonthly: string;
  hybridMode: "per_call" | "per_unit";
  hybridPerCallOrUnit: string;
  hourlyRate: string;
  callOutFee: string;
  materialsMarkupPercent: string;
  materialsIncluded: boolean;
  materialsNotes: string;
  responseUrgentHours: string;
  responseStandardHours: string;
  slaNotes: string;
  // Step 4
  notes: string;
  status: "draft" | "pending_signature" | "active";
}

const STEPS = [
  { key: 1, label: "Parties & period" },
  { key: 2, label: "Properties" },
  { key: 3, label: "Scope & fees" },
  { key: 4, label: "Review & save" },
] as const;

function todayISO() { return new Date().toISOString().slice(0, 10); }
function addMonths(iso: string, months: number) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
function addYears(iso: string, years: number) {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function ServiceAgreementWizard({
  open,
  onOpenChange,
  editContractId,
  presetVendorId,
  presetSubjects,
  onSaved,
}: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [self, setSelf] = useState<SelfPerson | null>(null);
  const [selfLoading, setSelfLoading] = useState(true);
  const [vendorContacts, setVendorContacts] = useState<VendorContactRow[]>([]);
  const [confirmActiveEditOpen, setConfirmActiveEditOpen] = useState(false);
  const [originalSnapshot, setOriginalSnapshot] = useState<{
    status: string;
    feeModel: string;
    feeValue: number | null;
    startDate: string | null;
    endDate: string | null;
  } | null>(null);

  const isEdit = !!editContractId;

  const [form, setForm] = useState<FormState>(() => ({
    vendor: null,
    vendorSignatory: null,
    additionalSignatories: [],
    title: "",
    externalReference: "",
    startDate: todayISO(),
    endDate: addYears(todayISO(), 1),
    durationPreset: "1y",
    autoRenew: false,
    terminationNoticeDays: 30,
    subjects: presetSubjects ?? [],
    scope: [],
    scopeOther: "",
    serviceFrequency: "on_demand",
    feeModel: "fixed_monthly",
    feeValue: "",
    hybridBaseMonthly: "",
    hybridMode: "per_call",
    hybridPerCallOrUnit: "",
    hourlyRate: "",
    callOutFee: "",
    materialsMarkupPercent: "",
    materialsIncluded: false,
    materialsNotes: "",
    responseUrgentHours: "",
    responseStandardHours: "",
    slaNotes: "",
    notes: "",
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

  // Pre-fill on edit
  useEffect(() => {
    if (!open || !editContractId) return;
    (async () => {
      const [cRes, saRes, pRes, sRes] = await Promise.all([
        supabase.from("contracts").select("*").eq("id", editContractId).maybeSingle(),
        supabase.from("service_agreements").select("*").eq("contract_id", editContractId).maybeSingle(),
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
      const sa = saRes.data as any;
      if (!c || !sa) return;

      // Vendor
      const { data: vendorRow } = await supabase
        .from("vendors")
        .select(
          "id, legal_name, display_name, vendor_number, is_preferred, specialties, trade_license_expiry_date, insurance_expiry_date, status",
        )
        .eq("id", sa.vendor_id)
        .maybeSingle();
      const vendor = (vendorRow ?? null) as PickedVendor | null;

      const allParties = (pRes.data ?? []) as any[];
      const vendorSigRow = allParties.find(
        (p) => p.role === "service_provider" && p.person_id !== self?.id,
      );
      const vendorSignatory: PickedPerson | null = vendorSigRow
        ? {
            id: vendorSigRow.people.id,
            first_name: vendorSigRow.people.first_name,
            last_name: vendorSigRow.people.last_name,
            company: vendorSigRow.people.company,
          }
        : null;

      const additionalSignatories: AdditionalSignatory[] = allParties
        .filter(
          (p) =>
            !["service_provider", "client"].includes(p.role) && p.person_id !== self?.id,
        )
        .map((p) => ({
          person: {
            id: p.people.id,
            first_name: p.people.first_name,
            last_name: p.people.last_name,
            company: p.people.company,
          },
          role: (p.role === "guarantor" ? "guarantor" : "other") as AdditionalSignatory["role"],
        }));

      // Subjects
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
        vendor,
        vendorSignatory,
        additionalSignatories,
        title: c.title ?? "",
        externalReference: c.external_reference ?? "",
        startDate: c.start_date ?? todayISO(),
        endDate: c.end_date ?? addYears(todayISO(), 1),
        durationPreset: "custom",
        autoRenew: !!c.auto_renew,
        terminationNoticeDays: 30,
        subjects,
        scope: (sa.scope_of_services ?? []) as ServiceScope[],
        scopeOther: sa.scope_of_services_other ?? "",
        serviceFrequency: (sa.service_frequency ?? "on_demand") as ServiceFrequency,
        feeModel: (sa.fee_model ?? "fixed_monthly") as ServiceFeeModel,
        feeValue: sa.fee_value != null ? String(sa.fee_value) : "",
        hybridBaseMonthly: sa.hybrid_base_monthly != null ? String(sa.hybrid_base_monthly) : "",
        hybridMode: (sa.hybrid_mode ?? "per_call") as any,
        hybridPerCallOrUnit: sa.hybrid_per_call_or_unit != null ? String(sa.hybrid_per_call_or_unit) : "",
        hourlyRate: sa.hourly_rate != null ? String(sa.hourly_rate) : "",
        callOutFee: sa.call_out_fee != null ? String(sa.call_out_fee) : "",
        materialsMarkupPercent: sa.materials_markup_percent != null ? String(sa.materials_markup_percent) : "",
        materialsIncluded: !!sa.materials_included,
        materialsNotes: sa.materials_notes ?? "",
        responseUrgentHours: sa.response_time_urgent_hours != null ? String(sa.response_time_urgent_hours) : "",
        responseStandardHours: sa.response_time_standard_hours != null ? String(sa.response_time_standard_hours) : "",
        slaNotes: sa.sla_notes ?? "",
        notes: c.notes ?? "",
        status: c.status,
      });

      setOriginalSnapshot({
        status: c.status,
        feeModel: sa.fee_model ?? "",
        feeValue: sa.fee_value,
        startDate: c.start_date,
        endDate: c.end_date,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editContractId, self?.id]);

  // Pre-fill from preset (create mode only)
  useEffect(() => {
    if (!open || isEdit || !presetVendorId) return;
    (async () => {
      const { data } = await supabase
        .from("vendors")
        .select(
          "id, legal_name, display_name, vendor_number, is_preferred, specialties, trade_license_expiry_date, insurance_expiry_date, status",
        )
        .eq("id", presetVendorId)
        .maybeSingle();
      if (data) {
        setForm((s) => ({ ...s, vendor: data as PickedVendor }));
      }
    })();
  }, [open, isEdit, presetVendorId]);

  // Load vendor contacts when vendor changes
  useEffect(() => {
    if (!form.vendor) {
      setVendorContacts([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("vendor_contacts")
        .select("id, person_id, is_primary, role, people(id, first_name, last_name, company)")
        .eq("vendor_id", form.vendor!.id)
        .order("is_primary", { ascending: false });
      setVendorContacts((data ?? []) as VendorContactRow[]);
      // Auto-select primary contact in create mode if none picked yet
      if (!isEdit && !form.vendorSignatory && data && data.length > 0) {
        const primary = data.find((c: any) => c.is_primary) ?? data[0];
        if (primary?.people) {
          setForm((s) => ({
            ...s,
            vendorSignatory: {
              id: primary.people!.id,
              first_name: primary.people!.first_name,
              last_name: primary.people!.last_name,
              company: primary.people!.company,
            },
          }));
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vendor?.id]);

  // Auto-update title from vendor name (create mode)
  useEffect(() => {
    if (isEdit) return;
    if (!form.vendor) return;
    const name = vendorDisplayName(form.vendor);
    if (!form.title || form.title.startsWith("Service Agreement —")) {
      setForm((s) => ({ ...s, title: `Service Agreement — ${name}` }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vendor?.id]);

  // Duration preset → end date
  useEffect(() => {
    if (form.durationPreset === "custom") return;
    const next =
      form.durationPreset === "6m"
        ? addMonths(form.startDate, 6)
        : form.durationPreset === "1y"
          ? addYears(form.startDate, 1)
          : addYears(form.startDate, 2);
    setForm((s) => ({ ...s, endDate: next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.durationPreset, form.startDate]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  /* ===================== validation ===================== */
  const step1Valid =
    !!form.vendor &&
    !!form.vendorSignatory &&
    !!form.title.trim() &&
    !!form.startDate &&
    !!form.endDate &&
    new Date(form.endDate) > new Date(form.startDate) &&
    Number(form.terminationNoticeDays) >= 0;

  const step2Valid = form.subjects.length > 0;

  const step3Valid = useMemo(() => {
    if (form.scope.length === 0) return false;
    if (form.scope.includes("other") && !form.scopeOther.trim()) return false;
    const num = (s: string) => Number.isFinite(Number(s)) && Number(s) > 0;
    switch (form.feeModel) {
      case "fixed_monthly":
      case "fixed_annual":
      case "per_call":
      case "per_unit":
        return num(form.feeValue);
      case "hybrid":
        return num(form.hybridBaseMonthly) && num(form.hybridPerCallOrUnit);
      case "time_and_materials":
        return num(form.hourlyRate);
      case "quote_based":
        return true;
      default:
        return false;
    }
  }, [form]);

  const canProceed = step === 1 ? step1Valid : step === 2 ? step2Valid : step === 3 ? step3Valid : true;

  const vendorName = form.vendor ? vendorDisplayName(form.vendor) : null;
  const vendorSpecs = form.vendor ? parseSpecialties(form.vendor.specialties) : [];

  /* ===================== save ===================== */
  const buildSaPayload = () => ({
    vendor_id: form.vendor!.id,
    scope_of_services: form.scope,
    scope_of_services_other: form.scopeOther.trim() || null,
    service_frequency: form.serviceFrequency,
    fee_model: form.feeModel,
    fee_value:
      form.feeModel === "hybrid" || form.feeModel === "time_and_materials" || form.feeModel === "quote_based"
        ? null
        : Number(form.feeValue),
    hybrid_base_monthly: form.feeModel === "hybrid" ? Number(form.hybridBaseMonthly) : null,
    hybrid_per_call_or_unit: form.feeModel === "hybrid" ? Number(form.hybridPerCallOrUnit) : null,
    hybrid_mode: form.feeModel === "hybrid" ? form.hybridMode : null,
    hourly_rate: form.feeModel === "time_and_materials" ? Number(form.hourlyRate) : null,
    call_out_fee:
      form.feeModel === "time_and_materials" && form.callOutFee ? Number(form.callOutFee) : null,
    materials_markup_percent:
      form.feeModel === "time_and_materials" && form.materialsMarkupPercent
        ? Number(form.materialsMarkupPercent)
        : null,
    materials_included: form.materialsIncluded,
    materials_notes: form.materialsNotes.trim() || null,
    response_time_urgent_hours: form.responseUrgentHours ? Number(form.responseUrgentHours) : null,
    response_time_standard_hours: form.responseStandardHours ? Number(form.responseStandardHours) : null,
    sla_notes: form.slaNotes.trim() || null,
  });

  const performSave = async () => {
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

    // ========= EDIT =========
    if (isEdit && editContractId) {
      const { error: cErr } = await supabase
        .from("contracts")
        .update({
          external_reference: form.externalReference.trim() || null,
          title: form.title.trim(),
          start_date: form.startDate,
          end_date: form.endDate,
          auto_renew: form.autoRenew,
          notes: form.notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editContractId);
      if (cErr) { setSubmitting(false); toast.error(cErr.message); return; }

      const { error: saErr } = await supabase
        .from("service_agreements")
        .update({ ...buildSaPayload(), updated_at: new Date().toISOString() })
        .eq("contract_id", editContractId);
      if (saErr) { setSubmitting(false); toast.error(saErr.message); return; }

      // Replace parties
      await supabase.from("contract_parties").delete().eq("contract_id", editContractId);
      const newParties = [
        { contract_id: editContractId, person_id: self.id, role: "client", is_signatory: true },
        { contract_id: editContractId, person_id: form.vendorSignatory!.id, role: "service_provider", is_signatory: true },
        ...form.additionalSignatories
          .filter((s) => !!s.person)
          .map((s) => ({
            contract_id: editContractId,
            person_id: s.person!.id,
            role: s.role,
            is_signatory: true,
          })),
      ];
      await supabase.from("contract_parties").insert(newParties);

      // Replace subjects
      await supabase.from("contract_subjects").delete().eq("contract_id", editContractId);
      await supabase.from("contract_subjects").insert(
        form.subjects.map((s) => ({
          contract_id: editContractId,
          entity_type: s.entity_type,
          entity_id: s.entity_id,
          role: "subject",
        })),
      );

      const changes: string[] = [];
      if (originalSnapshot) {
        if (originalSnapshot.feeModel !== form.feeModel) changes.push("fee model");
        if (originalSnapshot.feeValue !== Number(form.feeValue || 0)) changes.push("fee value");
        if (originalSnapshot.startDate !== form.startDate) changes.push("start date");
        if (originalSnapshot.endDate !== form.endDate) changes.push("end date");
      }
      const desc = changes.length > 0 ? `Amended: ${changes.join(", ")}` : "Amended contract details";
      await supabase.from("contract_events").insert({
        contract_id: editContractId,
        event_type: "amended",
        description: desc,
        actor_id: u.user?.id,
      });

      setSubmitting(false);
      toast.success("Contract updated.");
      onOpenChange(false);
      onSaved?.(editContractId);
      return;
    }

    // ========= CREATE =========
    const year = new Date().getFullYear();
    const { data: settings } = await supabase
      .from("app_settings")
      .select("default_currency")
      .maybeSingle();
    const currency = settings?.default_currency ?? "AED";

    const { data: numberResult, error: numErr } = await supabase.rpc("next_number", {
      p_prefix: "SVA",
      p_year: year,
    });
    if (numErr || !numberResult) {
      setSubmitting(false);
      toast.error("Could not generate contract number.");
      return;
    }
    const contractNumber = numberResult as string;

    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .insert({
        contract_type: "service_agreement",
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
    if (cErr || !contract) { setSubmitting(false); toast.error(cErr?.message ?? "Could not create contract."); return; }
    const contractId = contract.id as string;

    const { error: saErr } = await supabase
      .from("service_agreements")
      .insert({ contract_id: contractId, ...buildSaPayload() });
    if (saErr) {
      await supabase.from("contracts").delete().eq("id", contractId);
      setSubmitting(false);
      toast.error(saErr.message);
      return;
    }

    const partyRows = [
      { contract_id: contractId, person_id: self.id, role: "client", is_signatory: true },
      { contract_id: contractId, person_id: form.vendorSignatory!.id, role: "service_provider", is_signatory: true },
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
    onSaved?.(contractId);
    navigate(`/contracts/${contractId}`);
  };

  const handleSave = () => {
    if (isEdit && originalSnapshot?.status === "active") {
      const risky =
        originalSnapshot.feeModel !== form.feeModel ||
        originalSnapshot.feeValue !== Number(form.feeValue || 0) ||
        originalSnapshot.startDate !== form.startDate ||
        originalSnapshot.endDate !== form.endDate;
      if (risky) {
        setConfirmActiveEditOpen(true);
        return;
      }
    }
    performSave();
  };

  /* ===================== render ===================== */
  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {isEdit ? "Edit Service Agreement" : "New Service Agreement"}
          </DialogTitle>
          <DialogDescription>
            Define the relationship with a vendor: properties covered, scope of services, fee structure, and SLA.
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
            {/* ========== STEP 1 ========== */}
            {step === 1 && (
              <div className="space-y-5 py-2">
                <div className="border hairline rounded-sm bg-warm-stone/20 p-3 flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-gold-deep" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <div className="label-eyebrow">PM Company (Client)</div>
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
                  <Label className="label-eyebrow">Vendor (Service Provider) *</Label>
                  <VendorPicker
                    value={form.vendor?.id ?? null}
                    onChange={(v) => {
                      // Reset signatory when vendor changes
                      setForm((s) => ({
                        ...s,
                        vendor: v,
                        vendorSignatory: null,
                      }));
                    }}
                    placeholder="Search vendors…"
                    allowClear={false}
                  />
                  {vendorSpecs.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {vendorSpecs.slice(0, 6).map((sp) => (
                        <span
                          key={sp}
                          className="inline-block text-[10px] uppercase tracking-wider mono text-true-taupe bg-warm-stone/40 border hairline px-1.5 py-0.5 rounded-sm"
                        >
                          {SPECIALTY_LABELS[sp]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {form.vendor && (
                  <div className="space-y-1.5">
                    <Label className="label-eyebrow">Vendor signatory *</Label>
                    {vendorContacts.length === 0 ? (
                      <div className="text-xs text-muted-foreground border hairline rounded-sm p-3 bg-muted/30">
                        No contacts on file for {vendorName}. Add a contact on the vendor page first, then return here.
                      </div>
                    ) : (
                      <Select
                        value={form.vendorSignatory?.id ?? ""}
                        onValueChange={(id) => {
                          const c = vendorContacts.find((vc) => vc.person_id === id);
                          if (c?.people) {
                            update("vendorSignatory", {
                              id: c.people.id,
                              first_name: c.people.first_name,
                              last_name: c.people.last_name,
                              company: c.people.company,
                            });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a contact…" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendorContacts.map((c) => (
                            <SelectItem key={c.id} value={c.person_id}>
                              {c.people
                                ? `${c.people.first_name} ${c.people.last_name}`
                                : "(unknown)"}
                              {c.is_primary && " · Primary"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Who will sign on behalf of {vendorName ?? "the vendor"}?
                    </p>
                  </div>
                )}

                {/* Additional signatories */}
                <div className="border hairline rounded-sm p-3 bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-architect">Additional signatories</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        update("additionalSignatories", [
                          ...form.additionalSignatories,
                          { person: null, role: "other" },
                        ])
                      }
                    >
                      + Add
                    </Button>
                  </div>
                  {form.additionalSignatories.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Optional. Add witnesses or other parties who need to sign.
                    </p>
                  )}
                  {form.additionalSignatories.map((sig, idx) => {
                    const sigName = sig.person
                      ? sig.person.company || `${sig.person.first_name} ${sig.person.last_name}`.trim()
                      : "";
                    return (
                      <div key={idx} className="grid grid-cols-[1fr_140px_auto] gap-2 items-end">
                        <PersonCombobox
                          value={sig.person?.id ?? ""}
                          valueLabel={sigName}
                          onChange={(p) => {
                            const next = [...form.additionalSignatories];
                            next[idx] = { ...next[idx], person: p };
                            update("additionalSignatories", next);
                          }}
                          placeholder="Search person…"
                        />
                        <Select
                          value={sig.role}
                          onValueChange={(v) => {
                            const next = [...form.additionalSignatories];
                            next[idx] = { ...next[idx], role: v as any };
                            update("additionalSignatories", next);
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="other">Other</SelectItem>
                            <SelectItem value="guarantor">Guarantor</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const next = form.additionalSignatories.filter((_, i) => i !== idx);
                            update("additionalSignatories", next);
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  <Label className="label-eyebrow">Title *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                    placeholder="Service Agreement — …"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="label-eyebrow">External reference</Label>
                  <Input
                    value={form.externalReference}
                    onChange={(e) => update("externalReference", e.target.value)}
                    placeholder="Vendor's contract number, PO ref, etc."
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
                        <SelectItem value="1y">1 year</SelectItem>
                        <SelectItem value="2y">2 years</SelectItem>
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
                    Days of notice either party must give to terminate.
                  </p>
                </div>
              </div>
            )}

            {/* ========== STEP 2 ========== */}
            {step === 2 && (
              <div className="space-y-4 py-2">
                <div>
                  <h3 className="font-display text-lg text-architect">Properties Covered</h3>
                  <p className="text-sm text-muted-foreground">
                    Select the buildings or units this service agreement applies to.
                  </p>
                </div>
                <SubjectPicker
                  selected={form.subjects}
                  onChange={(s) => update("subjects", s)}
                />
              </div>
            )}

            {/* ========== STEP 3 ========== */}
            {step === 3 && (
              <div className="space-y-5 py-2">
                {/* Scope */}
                <div className="space-y-2">
                  <Label className="label-eyebrow">Scope of services *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {SERVICE_SCOPES.map((sv) => {
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
                          <span className="text-sm text-architect">{SERVICE_SCOPE_LABELS[sv]}</span>
                        </label>
                      );
                    })}
                  </div>
                  {form.scope.includes("other") && (
                    <Input
                      placeholder="Describe other services *"
                      value={form.scopeOther}
                      onChange={(e) => update("scopeOther", e.target.value)}
                      className="mt-2"
                    />
                  )}
                </div>

                {/* Frequency */}
                <div className="space-y-1.5">
                  <Label className="label-eyebrow">Service frequency *</Label>
                  <Select
                    value={form.serviceFrequency}
                    onValueChange={(v) => update("serviceFrequency", v as ServiceFrequency)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SERVICE_FREQUENCIES.map((f) => (
                        <SelectItem key={f} value={f}>{SERVICE_FREQUENCY_LABELS[f]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    How often does the vendor visit or perform work? Use On-demand for emergency / on-call services.
                  </p>
                </div>

                {/* Fee model */}
                <div className="space-y-1.5">
                  <Label className="label-eyebrow">Fee model *</Label>
                  <Select value={form.feeModel} onValueChange={(v) => update("feeModel", v as ServiceFeeModel)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SERVICE_FEE_MODELS.map((m) => (
                        <SelectItem key={m} value={m}>{SERVICE_FEE_MODEL_LABELS[m]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Conditional fee fields */}
                {(form.feeModel === "fixed_monthly"
                  || form.feeModel === "fixed_annual"
                  || form.feeModel === "per_call"
                  || form.feeModel === "per_unit") && (
                  <div className="space-y-1.5">
                    <Label className="label-eyebrow">
                      Fee amount * (AED
                      {form.feeModel === "fixed_monthly" ? " / month"
                        : form.feeModel === "fixed_annual" ? " / year"
                        : form.feeModel === "per_call" ? " per call"
                        : " per unit"})
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.feeValue}
                      onChange={(e) => update("feeValue", e.target.value)}
                      className="mono"
                    />
                    {form.feeModel === "per_unit" && form.feeValue && form.subjects.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Estimated total: AED {Number(form.feeValue).toLocaleString()} × {form.subjects.length} =
                        {" "}
                        AED {(Number(form.feeValue) * form.subjects.length).toLocaleString()} per billing cycle
                      </p>
                    )}
                  </div>
                )}

                {form.feeModel === "hybrid" && (
                  <div className="space-y-3 border hairline rounded-sm p-3 bg-card">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="label-eyebrow">Base monthly fee * (AED)</Label>
                        <Input
                          type="number"
                          value={form.hybridBaseMonthly}
                          onChange={(e) => update("hybridBaseMonthly", e.target.value)}
                          className="mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="label-eyebrow">Variable mode *</Label>
                        <RadioGroup
                          value={form.hybridMode}
                          onValueChange={(v) => update("hybridMode", v as any)}
                          className="flex gap-4 pt-2"
                        >
                          <label className="flex items-center gap-2 text-sm text-architect cursor-pointer">
                            <RadioGroupItem value="per_call" /> Per call
                          </label>
                          <label className="flex items-center gap-2 text-sm text-architect cursor-pointer">
                            <RadioGroupItem value="per_unit" /> Per unit
                          </label>
                        </RadioGroup>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="label-eyebrow">
                        Variable amount * (AED {form.hybridMode === "per_unit" ? "/ unit" : "/ call"})
                      </Label>
                      <Input
                        type="number"
                        value={form.hybridPerCallOrUnit}
                        onChange={(e) => update("hybridPerCallOrUnit", e.target.value)}
                        className="mono"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Vendor earns the base monthly fee plus the variable amount per call/unit as applicable.
                    </p>
                  </div>
                )}

                {form.feeModel === "time_and_materials" && (
                  <div className="space-y-3 border hairline rounded-sm p-3 bg-card">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="label-eyebrow">Hourly rate * (AED/hr)</Label>
                        <Input
                          type="number"
                          value={form.hourlyRate}
                          onChange={(e) => update("hourlyRate", e.target.value)}
                          className="mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="label-eyebrow">Call-out fee (AED)</Label>
                        <Input
                          type="number"
                          value={form.callOutFee}
                          onChange={(e) => update("callOutFee", e.target.value)}
                          className="mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="label-eyebrow">Materials markup %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.materialsMarkupPercent}
                          onChange={(e) => update("materialsMarkupPercent", e.target.value)}
                          className="mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {form.feeModel === "quote_based" && (
                  <div className="text-xs text-muted-foreground border hairline rounded-sm p-3 bg-muted/30">
                    No pre-agreed rate — every job will be quoted separately on the ticket.
                  </div>
                )}

                {/* Materials */}
                <div className="border hairline rounded-sm p-3 bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm text-architect">Materials included in fee?</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Toggle off if materials are billed separately.
                      </p>
                    </div>
                    <Switch
                      checked={form.materialsIncluded}
                      onCheckedChange={(v) => update("materialsIncluded", v)}
                    />
                  </div>
                  <Textarea
                    rows={2}
                    placeholder={
                      form.materialsIncluded
                        ? "Optional notes on what's covered…"
                        : "How are materials billed? (cost + markup, separate invoice, etc.)"
                    }
                    value={form.materialsNotes}
                    onChange={(e) => update("materialsNotes", e.target.value)}
                  />
                </div>

                {/* SLA */}
                <div className="border hairline rounded-sm p-3 bg-card space-y-3">
                  <div>
                    <Label className="text-sm text-architect">SLA (optional)</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Expected response times from the vendor. Used for ticket age monitoring.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="label-eyebrow">Urgent response (hours)</Label>
                      <Input
                        type="number"
                        value={form.responseUrgentHours}
                        onChange={(e) => update("responseUrgentHours", e.target.value)}
                        className="mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="label-eyebrow">Standard response (hours)</Label>
                      <Input
                        type="number"
                        value={form.responseStandardHours}
                        onChange={(e) => update("responseStandardHours", e.target.value)}
                        className="mono"
                      />
                    </div>
                  </div>
                  <Textarea
                    rows={2}
                    placeholder="Additional SLA notes…"
                    value={form.slaNotes}
                    onChange={(e) => update("slaNotes", e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* ========== STEP 4 ========== */}
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

                <div className="space-y-3 border hairline rounded-sm bg-card p-4">
                  <div className="label-eyebrow">Review</div>
                  <ReviewLine label="Vendor" value={vendorName ?? "—"} />
                  <ReviewLine
                    label="Signatory"
                    value={
                      form.vendorSignatory
                        ? `${form.vendorSignatory.first_name} ${form.vendorSignatory.last_name}`
                        : "—"
                    }
                  />
                  <ReviewLine label="Title" value={form.title} />
                  <ReviewLine
                    label="Period"
                    value={`${form.startDate} → ${form.endDate}${form.autoRenew ? " · auto-renew" : ""}`}
                  />
                  <ReviewLine label="Properties" value={`${form.subjects.length} subject(s)`} />
                  <ReviewLine
                    label="Frequency"
                    value={SERVICE_FREQUENCY_LABELS[form.serviceFrequency]}
                  />
                  <ReviewLine
                    label="Scope"
                    value={form.scope.length > 0 ? form.scope.map((s) => SERVICE_SCOPE_LABELS[s]).join(", ") : "—"}
                  />
                  <ReviewLine
                    label="Fee"
                    value={formatServiceFee(form.feeModel, {
                      fee_value: form.feeValue ? Number(form.feeValue) : null,
                      hybrid_base_monthly: form.hybridBaseMonthly ? Number(form.hybridBaseMonthly) : null,
                      hybrid_per_call_or_unit: form.hybridPerCallOrUnit
                        ? Number(form.hybridPerCallOrUnit)
                        : null,
                      hybrid_mode: form.hybridMode,
                      hourly_rate: form.hourlyRate ? Number(form.hourlyRate) : null,
                      materials_markup_percent: form.materialsMarkupPercent
                        ? Number(form.materialsMarkupPercent)
                        : null,
                      subjects_count: form.subjects.length,
                    })}
                  />
                  <ReviewLine
                    label="Materials"
                    value={form.materialsIncluded ? "Included in fee" : "Billed separately"}
                  />
                </div>

                {!isEdit && (
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
                )}
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
                    <><Loader2 className="h-4 w-4 animate-spin" /> {isEdit ? "Saving…" : "Creating…"}</>
                  ) : (
                    isEdit ? "Save changes" : "Create contract"
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmActiveEditOpen} onOpenChange={setConfirmActiveEditOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save changes to an active contract?</AlertDialogTitle>
          <AlertDialogDescription>
            This service agreement is active. Changes to fee model, fee value, or contract dates will be logged in history. Continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => { setConfirmActiveEditOpen(false); performSave(); }}>
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
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