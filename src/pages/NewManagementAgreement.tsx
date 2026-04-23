import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { PersonCombobox, type PickedPerson } from "@/components/owners/PersonCombobox";
import { UnitMultiPicker, type PickedUnitSubject } from "@/components/contracts/UnitMultiPicker";
import {
  APPROVAL_RULE_LABEL,
  FEE_MODEL_LABEL,
  INCLUDED_SERVICES_CATALOG,
  type MaApprovalRule,
  type MaFeeModel,
} from "@/lib/contracts";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "parties", label: "Parties" },
  { key: "properties", label: "Properties" },
  { key: "fee", label: "Fee & Period" },
  { key: "scope", label: "Scope & Approval" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

interface FormState {
  title: string;
  landlord: PickedPerson | null;
  pmCompany: PickedPerson | null;
  subjects: PickedUnitSubject[];
  startDate: string;
  endDate: string;
  signedDate: string;
  currency: string;
  feeModel: MaFeeModel;
  feePercent: string;
  feeFlatAnnual: string;
  feeFlatPerUnit: string;
  feeNotes: string;
  includedServices: string[];
  approvalRule: MaApprovalRule;
  approvalThreshold: string;
  leaseUpFeeModel: string;
  leaseUpFeeValue: string;
  terminationNoticeDays: string;
  autoRenew: boolean;
  renewalNoticeDays: string;
  repairAuthTerms: string;
  scopeNotes: string;
}

const INITIAL: FormState = {
  title: "",
  landlord: null,
  pmCompany: null,
  subjects: [],
  startDate: "",
  endDate: "",
  signedDate: "",
  currency: "AED",
  feeModel: "percent_of_rent",
  feePercent: "5",
  feeFlatAnnual: "",
  feeFlatPerUnit: "",
  feeNotes: "",
  includedServices: ["tenant_search", "rent_collection", "biannual_inspection", "lease_renewal", "monthly_reporting"],
  approvalRule: "auto_threshold",
  approvalThreshold: "500",
  leaseUpFeeModel: "percent_of_first_year_rent",
  leaseUpFeeValue: "",
  terminationNoticeDays: "60",
  autoRenew: false,
  renewalNoticeDays: "60",
  repairAuthTerms: "",
  scopeNotes: "",
};

export default function NewManagementAgreement() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [saving, setSaving] = useState(false);

  // Auto-fill PM company from app_settings.self_person_id
  useEffect(() => {
    (async () => {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("self_person_id")
        .maybeSingle();
      if (settings?.self_person_id) {
        const { data: p } = await supabase
          .from("people")
          .select("id, first_name, last_name, company")
          .eq("id", settings.self_person_id)
          .maybeSingle();
        if (p) setForm((f) => ({ ...f, pmCompany: p as PickedPerson }));
      }
    })();
  }, []);

  const step = STEPS[stepIndex];

  const update = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const toggleService = (key: string) =>
    setForm((f) => ({
      ...f,
      includedServices: f.includedServices.includes(key)
        ? f.includedServices.filter((k) => k !== key)
        : [...f.includedServices, key],
    }));

  const stepValid = useMemo(() => {
    switch (step.key) {
      case "parties":
        return !!form.landlord && !!form.pmCompany;
      case "properties":
        return form.subjects.length > 0;
      case "fee":
        if (!form.startDate) return false;
        if (form.feeModel === "percent_of_rent" && !form.feePercent) return false;
        if (form.feeModel === "flat_annual" && !form.feeFlatAnnual) return false;
        if (form.feeModel === "flat_per_unit" && !form.feeFlatPerUnit) return false;
        return true;
      case "scope":
        if (form.approvalRule === "auto_threshold" && !form.approvalThreshold) return false;
        return true;
    }
  }, [step, form]);

  const goNext = () => {
    if (!stepValid) return;
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
  };
  const goBack = () => stepIndex > 0 && setStepIndex(stepIndex - 1);

  const save = async (asActive: boolean) => {
    if (!form.landlord || !form.pmCompany) {
      toast.error("Pick the landlord and PM company first.");
      return;
    }
    setSaving(true);
    try {
      const year = new Date().getFullYear();
      const { data: numData, error: numErr } = await supabase.rpc("next_number", {
        p_prefix: "CTR",
        p_year: year,
      });
      if (numErr) throw numErr;

      const { data: contract, error: cErr } = await supabase
        .from("contracts")
        .insert({
          contract_number: numData as string,
          contract_type: "management_agreement",
          status: asActive ? "active" : "draft",
          title: form.title || null,
          start_date: form.startDate || null,
          end_date: form.endDate || null,
          signed_date: form.signedDate || null,
          currency: form.currency,
        })
        .select()
        .single();
      if (cErr) throw cErr;

      const parties = [
        { contract_id: contract.id, person_id: form.pmCompany.id, role: "pm_company" as const, is_primary: true },
        { contract_id: contract.id, person_id: form.landlord.id, role: "landlord" as const, is_primary: true },
      ];
      const { error: pErr } = await supabase.from("contract_parties").insert(parties);
      if (pErr) throw pErr;

      if (form.subjects.length > 0) {
        const { error: sErr } = await supabase.from("contract_subjects").insert(
          form.subjects.map((s) => ({
            contract_id: contract.id,
            subject_type: s.subject_type,
            subject_id: s.subject_id,
          })),
        );
        if (sErr) throw sErr;
      }

      const { error: maErr } = await supabase.from("management_agreements").insert({
        contract_id: contract.id,
        fee_model: form.feeModel,
        fee_percent: form.feeModel === "percent_of_rent" || form.feeModel === "hybrid" ? Number(form.feePercent) || null : null,
        fee_flat_annual: form.feeModel === "flat_annual" || form.feeModel === "hybrid" ? Number(form.feeFlatAnnual) || null : null,
        fee_flat_per_unit: form.feeModel === "flat_per_unit" ? Number(form.feeFlatPerUnit) || null : null,
        fee_notes: form.feeNotes || null,
        included_services: form.includedServices,
        approval_rule: form.approvalRule,
        approval_threshold_amount: form.approvalRule === "auto_threshold" ? Number(form.approvalThreshold) || null : null,
        approval_threshold_currency: form.currency,
        lease_up_fee_model: form.leaseUpFeeModel || null,
        lease_up_fee_value: form.leaseUpFeeValue ? Number(form.leaseUpFeeValue) : null,
        termination_notice_days: form.terminationNoticeDays ? Number(form.terminationNoticeDays) : null,
        auto_renew: form.autoRenew,
        renewal_notice_days: form.autoRenew && form.renewalNoticeDays ? Number(form.renewalNoticeDays) : null,
        repair_authorization_terms: form.repairAuthTerms || null,
        scope_notes: form.scopeNotes || null,
      });
      if (maErr) throw maErr;

      await supabase.from("contract_events").insert({
        contract_id: contract.id,
        event_type: "created",
        description: asActive ? "Created and activated" : "Created as draft",
        to_value: asActive ? "active" : "draft",
      });

      toast.success(`${contract.contract_number} created`);
      navigate(`/contracts/${contract.id}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to save contract");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="New contract"
        title="Management Agreement"
        description="PM company ↔ Landlord. Defines covered properties, fees, included services, and approval rules."
        actions={
          <Button variant="outline" onClick={() => navigate("/contracts")}>
            <ArrowLeft className="h-4 w-4" />
            Cancel
          </Button>
        }
      />

      {/* Stepper */}
      <div className="mb-8 flex items-center gap-2 overflow-x-auto">
        {STEPS.map((s, i) => {
          const done = i < stepIndex;
          const current = i === stepIndex;
          return (
            <div key={s.key} className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => i <= stepIndex && setStepIndex(i)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-sm border hairline text-xs uppercase tracking-wider transition-colors",
                  current && "bg-architect text-chalk border-architect",
                  done && !current && "text-architect hover:bg-muted/40 cursor-pointer",
                  !current && !done && "text-muted-foreground cursor-default",
                )}
              >
                <span
                  className={cn(
                    "h-5 w-5 rounded-full flex items-center justify-center text-[10px]",
                    current ? "bg-chalk text-architect" : done ? "bg-architect text-chalk" : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-warm-stone/60" />}
            </div>
          );
        })}
      </div>

      <div className="border hairline rounded-sm bg-card p-6 md:p-8 space-y-6">
        {step.key === "parties" && (
          <>
            <div>
              <Label htmlFor="title">Contract title (optional)</Label>
              <Input
                id="title"
                placeholder="e.g. Khan Family Portfolio – PM Agreement 2026"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <Label>PM Company</Label>
                <div className="mt-1.5">
                  <PersonCombobox
                    value={form.pmCompany?.id ?? ""}
                    valueLabel={
                      form.pmCompany
                        ? form.pmCompany.company || `${form.pmCompany.first_name} ${form.pmCompany.last_name}`
                        : ""
                    }
                    onChange={(p) => update("pmCompany", p)}
                    placeholder="Search PM company…"
                    hideAddNew
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Auto-filled from Settings → Company profile. Change if needed.
                </p>
              </div>
              <div>
                <Label>Landlord</Label>
                <div className="mt-1.5">
                  <PersonCombobox
                    value={form.landlord?.id ?? ""}
                    valueLabel={
                      form.landlord
                        ? form.landlord.company || `${form.landlord.first_name} ${form.landlord.last_name}`
                        : ""
                    }
                    onChange={(p) => update("landlord", p)}
                    placeholder="Search owner…"
                    roleFilter={["owner"]}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {step.key === "properties" && (
          <>
            <div>
              <Label>Units covered by this agreement</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Pick the specific units this PM agreement governs. Use "Select all" on a building to cover every unit inside it.
              </p>
            </div>
            <UnitMultiPicker value={form.subjects} onChange={(v) => update("subjects", v)} />
          </>
        )}

        {step.key === "fee" && (
          <>
            <div className="grid md:grid-cols-3 gap-5">
              <div>
                <Label htmlFor="start">Start date</Label>
                <Input id="start" type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="end">End date (optional)</Label>
                <Input id="end" type="date" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="signed">Signed date (optional)</Label>
                <Input id="signed" type="date" value={form.signedDate} onChange={(e) => update("signedDate", e.target.value)} className="mt-1.5" />
              </div>
            </div>

            <div>
              <Label>Fee structure</Label>
              <RadioGroup
                value={form.feeModel}
                onValueChange={(v) => update("feeModel", v as MaFeeModel)}
                className="mt-2 grid sm:grid-cols-2 gap-2"
              >
                {(Object.keys(FEE_MODEL_LABEL) as MaFeeModel[]).map((m) => (
                  <label
                    key={m}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 border hairline rounded-sm cursor-pointer text-sm",
                      form.feeModel === m ? "border-architect bg-muted/40" : "hover:bg-muted/30",
                    )}
                  >
                    <RadioGroupItem value={m} />
                    <span>{FEE_MODEL_LABEL[m]}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {(form.feeModel === "percent_of_rent" || form.feeModel === "hybrid") && (
                <div>
                  <Label htmlFor="feePercent">Fee percent (%)</Label>
                  <Input
                    id="feePercent"
                    type="number"
                    step="0.1"
                    value={form.feePercent}
                    onChange={(e) => update("feePercent", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              )}
              {(form.feeModel === "flat_annual" || form.feeModel === "hybrid") && (
                <div>
                  <Label htmlFor="feeFlat">Flat annual fee ({form.currency})</Label>
                  <Input
                    id="feeFlat"
                    type="number"
                    value={form.feeFlatAnnual}
                    onChange={(e) => update("feeFlatAnnual", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              )}
              {form.feeModel === "flat_per_unit" && (
                <div>
                  <Label htmlFor="feePerUnit">Flat fee per unit / year ({form.currency})</Label>
                  <Input
                    id="feePerUnit"
                    type="number"
                    value={form.feeFlatPerUnit}
                    onChange={(e) => update("feeFlatPerUnit", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select value={form.currency} onValueChange={(v) => update("currency", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AED">AED</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="SAR">SAR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="feeNotes">Fee notes (optional)</Label>
              <Textarea
                id="feeNotes"
                rows={2}
                value={form.feeNotes}
                onChange={(e) => update("feeNotes", e.target.value)}
                placeholder="Billing cadence, deductions, etc."
                className="mt-1.5"
              />
            </div>
          </>
        )}

        {step.key === "scope" && (
          <>
            <div>
              <Label>Included services (free, covered by this agreement)</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Anything not in this list is billable when requested. Drives free vs paid on every Service Request.
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {INCLUDED_SERVICES_CATALOG.map((s) => {
                  const checked = form.includedServices.includes(s.key);
                  return (
                    <label
                      key={s.key}
                      className={cn(
                        "flex items-start gap-2.5 p-3 border hairline rounded-sm cursor-pointer text-sm transition-colors",
                        checked ? "border-architect bg-muted/40" : "hover:bg-muted/30",
                      )}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleService(s.key)} className="mt-0.5" />
                      <div>
                        <div className="text-architect">{s.label}</div>
                        {s.description && <div className="text-[11px] text-muted-foreground mt-0.5">{s.description}</div>}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>Approval rule for paid work</Label>
              <RadioGroup
                value={form.approvalRule}
                onValueChange={(v) => update("approvalRule", v as MaApprovalRule)}
                className="mt-2 space-y-2"
              >
                {(Object.keys(APPROVAL_RULE_LABEL) as MaApprovalRule[]).map((r) => (
                  <label
                    key={r}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 border hairline rounded-sm cursor-pointer text-sm",
                      form.approvalRule === r ? "border-architect bg-muted/40" : "hover:bg-muted/30",
                    )}
                  >
                    <RadioGroupItem value={r} />
                    <span>{APPROVAL_RULE_LABEL[r]}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {form.approvalRule === "auto_threshold" && (
              <div className="grid md:grid-cols-3 gap-5">
                <div>
                  <Label htmlFor="threshold">Auto-approve threshold ({form.currency})</Label>
                  <Input
                    id="threshold"
                    type="number"
                    value={form.approvalThreshold}
                    onChange={(e) => update("approvalThreshold", e.target.value)}
                    className="mt-1.5"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Quotes under this auto-proceed; over this require landlord sign-off.</p>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-5">
              <div>
                <Label htmlFor="leaseUpModel">Lease-up fee model</Label>
                <Select value={form.leaseUpFeeModel} onValueChange={(v) => update("leaseUpFeeModel", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent_of_first_year_rent">% of first year's rent</SelectItem>
                    <SelectItem value="flat_per_lease">Flat fee per lease</SelectItem>
                    <SelectItem value="months_of_rent">N months of rent</SelectItem>
                    <SelectItem value="none">No lease-up fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="leaseUpVal">Lease-up fee value</Label>
                <Input
                  id="leaseUpVal"
                  type="number"
                  step="0.1"
                  value={form.leaseUpFeeValue}
                  onChange={(e) => update("leaseUpFeeValue", e.target.value)}
                  className="mt-1.5"
                  placeholder={form.leaseUpFeeModel === "percent_of_first_year_rent" ? "e.g. 5" : ""}
                />
              </div>
              <div>
                <Label htmlFor="termNotice">Termination notice (days)</Label>
                <Input
                  id="termNotice"
                  type="number"
                  value={form.terminationNoticeDays}
                  onChange={(e) => update("terminationNoticeDays", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 border hairline rounded-sm">
              <Switch checked={form.autoRenew} onCheckedChange={(v) => update("autoRenew", v)} />
              <div className="flex-1">
                <div className="text-sm text-architect">Auto-renew at end date</div>
                <div className="text-[11px] text-muted-foreground">Contract rolls over unless either party gives notice.</div>
              </div>
              {form.autoRenew && (
                <div className="w-40">
                  <Label htmlFor="renewNotice" className="text-[11px]">Renewal notice (days)</Label>
                  <Input
                    id="renewNotice"
                    type="number"
                    value={form.renewalNoticeDays}
                    onChange={(e) => update("renewalNoticeDays", e.target.value)}
                    className="mt-1 h-8"
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="repair">Repair authorization terms (optional)</Label>
              <Textarea
                id="repair"
                rows={3}
                value={form.repairAuthTerms}
                onChange={(e) => update("repairAuthTerms", e.target.value)}
                placeholder="Emergency repair authorization, after-hours protocols, etc."
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="scope">Additional scope notes (optional)</Label>
              <Textarea
                id="scope"
                rows={3}
                value={form.scopeNotes}
                onChange={(e) => update("scopeNotes", e.target.value)}
                className="mt-1.5"
              />
            </div>
          </>
        )}

        {/* Wizard footer */}
        <div className="flex items-center justify-between pt-4 border-t hairline">
          <Button variant="outline" onClick={goBack} disabled={stepIndex === 0 || saving}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => save(false)} disabled={saving || !form.landlord || !form.pmCompany}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save as draft
            </Button>
            {stepIndex < STEPS.length - 1 ? (
              <Button onClick={goNext} disabled={!stepValid || saving}>
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => save(true)} disabled={!stepValid || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Create &amp; activate
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}