import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, Save, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PersonCombobox, type PickedPerson } from "@/components/owners/PersonCombobox";
import { VendorPicker, type PickedVendor } from "@/components/contracts/VendorPicker";
import { CoveredServicesPicker } from "@/components/contracts/CoveredServicesPicker";
import {
  VSA_PAYMENT_TERMS_LABEL,
  VSA_RATE_MODEL_LABEL,
  type VsaPaymentTerms,
  type VsaRateModel,
} from "@/lib/contracts";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "vendor", label: "Vendor" },
  { key: "scope", label: "Scope" },
  { key: "rates", label: "Rates & Terms" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

interface FormState {
  title: string;
  vendor: PickedVendor | null;
  pmCompany: PickedPerson | null;
  startDate: string;
  endDate: string;
  signedDate: string;
  currency: string;

  coveredServices: string[];
  scopeNotes: string;
  isExclusive: boolean;
  serviceAreaNotes: string;

  rateModel: VsaRateModel;
  defaultCallOutFee: string;
  defaultHourlyRate: string;
  fixedVisitFee: string;
  materialsMarkupPercent: string;
  rateNotes: string;

  paymentTerms: VsaPaymentTerms;
  paymentTermsCustom: string;

  responseTimeHours: string;
  resolutionTimeHours: string;
  emergencyResponseTimeHours: string;
  slaNotes: string;

  repairAuthorizationThreshold: string;
  repairAuthorizationTerms: string;

  autoRenew: boolean;
  renewalNoticeDays: string;
  terminationNoticeDays: string;
}

const INITIAL: FormState = {
  title: "",
  vendor: null,
  pmCompany: null,
  startDate: "",
  endDate: "",
  signedDate: "",
  currency: "AED",
  coveredServices: [],
  scopeNotes: "",
  isExclusive: false,
  serviceAreaNotes: "",
  rateModel: "quote_required",
  defaultCallOutFee: "",
  defaultHourlyRate: "",
  fixedVisitFee: "",
  materialsMarkupPercent: "",
  rateNotes: "",
  paymentTerms: "net_30",
  paymentTermsCustom: "",
  responseTimeHours: "24",
  resolutionTimeHours: "",
  emergencyResponseTimeHours: "4",
  slaNotes: "",
  repairAuthorizationThreshold: "",
  repairAuthorizationTerms: "",
  autoRenew: false,
  renewalNoticeDays: "30",
  terminationNoticeDays: "30",
};

export default function NewVendorServiceAgreement() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [saving, setSaving] = useState(false);

  // Auto-fill PM company from app_settings
  useEffect(() => {
    void (async () => {
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

  // When vendor chosen, pre-fill rate defaults from vendor record
  useEffect(() => {
    if (!form.vendor) return;
    setForm((f) => ({
      ...f,
      currency: form.vendor!.currency || f.currency,
      defaultCallOutFee: f.defaultCallOutFee || (form.vendor!.default_call_out_fee?.toString() ?? ""),
      defaultHourlyRate: f.defaultHourlyRate || (form.vendor!.default_hourly_rate?.toString() ?? ""),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vendor?.id]);

  const step = STEPS[stepIndex];
  const update = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const stepValid = useMemo(() => {
    switch (step.key as StepKey) {
      case "vendor":
        return !!form.vendor && !!form.startDate;
      case "scope":
        return true; // empty covered services means "covers all"
      case "rates":
        return true;
    }
  }, [step, form]);

  const goNext = () => stepValid && stepIndex < STEPS.length - 1 && setStepIndex(stepIndex + 1);
  const goBack = () => stepIndex > 0 && setStepIndex(stepIndex - 1);

  const save = async (asActive: boolean) => {
    if (!form.vendor) {
      toast.error("Pick a vendor first.");
      return;
    }
    if (!form.startDate) {
      toast.error("Start date is required.");
      return;
    }
    setSaving(true);
    try {
      const year = new Date().getFullYear();
      const { data: numData, error: numErr } = await supabase.rpc("next_number", {
        p_prefix: "VSA",
        p_year: year,
      });
      if (numErr) throw numErr;

      const { data: contract, error: cErr } = await supabase
        .from("contracts")
        .insert({
          contract_number: numData as string,
          contract_type: "vendor_service_agreement",
          status: asActive ? "active" : "draft",
          title: form.title || null,
          start_date: form.startDate,
          end_date: form.endDate || null,
          signed_date: form.signedDate || null,
          currency: form.currency,
        })
        .select()
        .single();
      if (cErr) throw cErr;

      // PM company party (vendor isn't in `people`, so we record them as a subject in the VSA itself)
      if (form.pmCompany) {
        const { error: pErr } = await supabase.from("contract_parties").insert({
          contract_id: contract.id,
          person_id: form.pmCompany.id,
          role: "pm_company",
          is_primary: true,
        });
        if (pErr) throw pErr;
      }

      const { error: vErr } = await supabase.from("vendor_service_agreements").insert({
        contract_id: contract.id,
        vendor_id: form.vendor.id,
        covered_services: form.coveredServices,
        scope_notes: form.scopeNotes || null,
        is_exclusive: form.isExclusive,
        service_area_notes: form.serviceAreaNotes || null,
        rate_model: form.rateModel,
        default_call_out_fee: form.defaultCallOutFee ? Number(form.defaultCallOutFee) : null,
        default_hourly_rate: form.defaultHourlyRate ? Number(form.defaultHourlyRate) : null,
        fixed_visit_fee: form.fixedVisitFee ? Number(form.fixedVisitFee) : null,
        materials_markup_percent: form.materialsMarkupPercent ? Number(form.materialsMarkupPercent) : null,
        rate_notes: form.rateNotes || null,
        payment_terms: form.paymentTerms,
        payment_terms_custom: form.paymentTerms === "custom" ? form.paymentTermsCustom || null : null,
        response_time_hours: form.responseTimeHours ? Number(form.responseTimeHours) : null,
        resolution_time_hours: form.resolutionTimeHours ? Number(form.resolutionTimeHours) : null,
        emergency_response_time_hours: form.emergencyResponseTimeHours ? Number(form.emergencyResponseTimeHours) : null,
        sla_notes: form.slaNotes || null,
        repair_authorization_threshold: form.repairAuthorizationThreshold ? Number(form.repairAuthorizationThreshold) : null,
        repair_authorization_currency: form.currency,
        repair_authorization_terms: form.repairAuthorizationTerms || null,
        auto_renew: form.autoRenew,
        renewal_notice_days: form.renewalNoticeDays ? Number(form.renewalNoticeDays) : null,
        termination_notice_days: form.terminationNoticeDays ? Number(form.terminationNoticeDays) : null,
      });
      if (vErr) throw vErr;

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
      toast.error(e.message || "Failed to save VSA");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="New Contract"
        title="Vendor Service Agreement"
        description="PM company ↔ Vendor. Covered services, rate card, SLA terms and payment."
      />

      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={cn(
                "h-7 w-7 rounded-full border hairline flex items-center justify-center text-[11px]",
                stepIndex === i && "bg-architect text-chalk border-architect",
                stepIndex > i && "bg-status-occupied/20 text-status-occupied border-status-occupied/40",
                stepIndex < i && "text-muted-foreground",
              )}
            >
              {i + 1}
            </div>
            <span className={cn("text-[11px] uppercase tracking-wider", stepIndex === i ? "text-architect" : "text-muted-foreground")}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-warm-stone/60" />}
          </div>
        ))}
      </div>

      <Card className="hairline">
        {step.key === "vendor" && (
          <>
            <CardHeader>
              <CardTitle>Vendor & period</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Vendor</Label>
                <div className="mt-1.5">
                  <VendorPicker value={form.vendor} onChange={(v) => update("vendor", v)} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Don't see them? Add the vendor from People → Vendors first.
                </p>
              </div>

              {form.vendor && (
                <div className="border hairline rounded-sm bg-muted/20 p-3 flex items-center gap-3">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 text-xs">
                    <div className="text-architect">{form.vendor.legal_name}</div>
                    <div className="text-muted-foreground mt-0.5">
                      {form.vendor.primary_email || "—"} · {form.vendor.primary_phone || "—"}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label>PM company (auto-filled)</Label>
                <div className="mt-1.5">
                  <PersonCombobox
                    value={form.pmCompany}
                    onChange={(p) => update("pmCompany", p)}
                    placeholder="Pick your company…"
                    roleFilter={[]}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder="e.g. Annual AC maintenance contract — ACME HVAC"
                  className="mt-1.5"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>Start date</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label>End date (optional)</Label>
                  <Input type="date" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label>Signed date</Label>
                  <Input type="date" value={form.signedDate} onChange={(e) => update("signedDate", e.target.value)} className="mt-1.5" />
                </div>
              </div>
            </CardContent>
          </>
        )}

        {step.key === "scope" && (
          <>
            <CardHeader>
              <CardTitle>What can this vendor do for us?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CoveredServicesPicker
                value={form.coveredServices}
                onChange={(codes) => update("coveredServices", codes)}
              />

              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 border hairline rounded-sm">
                  <Switch checked={form.isExclusive} onCheckedChange={(v) => update("isExclusive", v)} />
                  <div className="flex-1">
                    <div className="text-sm text-architect">Exclusive vendor</div>
                    <div className="text-[11px] text-muted-foreground">
                      Route all matching requests to this vendor first.
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="serviceArea">Service area</Label>
                  <Input
                    id="serviceArea"
                    value={form.serviceAreaNotes}
                    onChange={(e) => update("serviceAreaNotes", e.target.value)}
                    placeholder="e.g. Dubai Marina, JBR, Palm"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="scopeNotes">Scope notes</Label>
                <Textarea
                  id="scopeNotes"
                  rows={3}
                  value={form.scopeNotes}
                  onChange={(e) => update("scopeNotes", e.target.value)}
                  placeholder="Any inclusions, exclusions, or special conditions on the scope…"
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </>
        )}

        {step.key === "rates" && (
          <>
            <CardHeader>
              <CardTitle>Rates, payment & SLA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label>Rate model</Label>
                <Select value={form.rateModel} onValueChange={(v) => update("rateModel", v as VsaRateModel)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(VSA_RATE_MODEL_LABEL) as VsaRateModel[]).map((r) => (
                      <SelectItem key={r} value={r}>{VSA_RATE_MODEL_LABEL[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                <div>
                  <Label>Currency</Label>
                  <Input value={form.currency} onChange={(e) => update("currency", e.target.value.toUpperCase())} className="mt-1.5 mono uppercase" />
                </div>
                <div>
                  <Label>Call-out fee</Label>
                  <Input type="number" value={form.defaultCallOutFee} onChange={(e) => update("defaultCallOutFee", e.target.value)} className="mt-1.5" placeholder="0" />
                </div>
                <div>
                  <Label>Hourly rate</Label>
                  <Input type="number" value={form.defaultHourlyRate} onChange={(e) => update("defaultHourlyRate", e.target.value)} className="mt-1.5" placeholder="0" />
                </div>
                <div>
                  <Label>Fixed per visit</Label>
                  <Input type="number" value={form.fixedVisitFee} onChange={(e) => update("fixedVisitFee", e.target.value)} className="mt-1.5" placeholder="0" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Materials markup (%)</Label>
                  <Input
                    type="number"
                    value={form.materialsMarkupPercent}
                    onChange={(e) => update("materialsMarkupPercent", e.target.value)}
                    className="mt-1.5"
                    placeholder="e.g. 15"
                  />
                </div>
                <div>
                  <Label>Rate notes</Label>
                  <Input
                    value={form.rateNotes}
                    onChange={(e) => update("rateNotes", e.target.value)}
                    className="mt-1.5"
                    placeholder="After-hours surcharge, weekends, etc."
                  />
                </div>
              </div>

              <div className="border-t hairline pt-5 grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Payment terms</Label>
                  <Select value={form.paymentTerms} onValueChange={(v) => update("paymentTerms", v as VsaPaymentTerms)}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(VSA_PAYMENT_TERMS_LABEL) as VsaPaymentTerms[]).map((t) => (
                        <SelectItem key={t} value={t}>{VSA_PAYMENT_TERMS_LABEL[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.paymentTerms === "custom" && (
                  <div>
                    <Label>Custom terms</Label>
                    <Input
                      value={form.paymentTermsCustom}
                      onChange={(e) => update("paymentTermsCustom", e.target.value)}
                      className="mt-1.5"
                      placeholder="Describe payment terms"
                    />
                  </div>
                )}
              </div>

              <div className="border-t hairline pt-5">
                <Label className="label-eyebrow text-muted-foreground">SLA</Label>
                <div className="grid md:grid-cols-3 gap-4 mt-2">
                  <div>
                    <Label>Response time (hrs)</Label>
                    <Input type="number" value={form.responseTimeHours} onChange={(e) => update("responseTimeHours", e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Resolution time (hrs)</Label>
                    <Input type="number" value={form.resolutionTimeHours} onChange={(e) => update("resolutionTimeHours", e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Emergency response (hrs)</Label>
                    <Input type="number" value={form.emergencyResponseTimeHours} onChange={(e) => update("emergencyResponseTimeHours", e.target.value)} className="mt-1.5" />
                  </div>
                </div>
                <Textarea
                  rows={2}
                  value={form.slaNotes}
                  onChange={(e) => update("slaNotes", e.target.value)}
                  placeholder="Additional SLA terms (penalties, escalation paths)…"
                  className="mt-3"
                />
              </div>

              <div className="border-t hairline pt-5">
                <Label className="label-eyebrow text-muted-foreground">Authorization</Label>
                <div className="grid md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label>Repair auth threshold ({form.currency})</Label>
                    <Input
                      type="number"
                      value={form.repairAuthorizationThreshold}
                      onChange={(e) => update("repairAuthorizationThreshold", e.target.value)}
                      className="mt-1.5"
                      placeholder="e.g. 500"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Vendor can proceed up to this amount without quote.</p>
                  </div>
                  <div>
                    <Label>Authorization terms</Label>
                    <Textarea
                      rows={2}
                      value={form.repairAuthorizationTerms}
                      onChange={(e) => update("repairAuthorizationTerms", e.target.value)}
                      placeholder="Quote required above threshold; emergencies bypass…"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t hairline pt-5 grid md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 border hairline rounded-sm">
                  <Switch checked={form.autoRenew} onCheckedChange={(v) => update("autoRenew", v)} />
                  <div className="flex-1">
                    <div className="text-sm text-architect">Auto-renew</div>
                    <div className="text-[11px] text-muted-foreground">Roll over at end date</div>
                  </div>
                </div>
                <div>
                  <Label>Renewal notice (days)</Label>
                  <Input type="number" value={form.renewalNoticeDays} onChange={(e) => update("renewalNoticeDays", e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label>Termination notice (days)</Label>
                  <Input type="number" value={form.terminationNoticeDays} onChange={(e) => update("terminationNoticeDays", e.target.value)} className="mt-1.5" />
                </div>
              </div>
            </CardContent>
          </>
        )}

        <div className="flex items-center justify-between p-4 border-t hairline">
          <Button variant="ghost" onClick={() => (stepIndex === 0 ? navigate("/contracts") : goBack())} disabled={saving}>
            <ArrowLeft className="h-4 w-4" />
            {stepIndex === 0 ? "Cancel" : "Back"}
          </Button>
          <div className="flex items-center gap-2">
            {stepIndex === STEPS.length - 1 ? (
              <>
                <Button variant="outline" onClick={() => save(false)} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save as draft
                </Button>
                <Button onClick={() => save(true)} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save & activate
                </Button>
              </>
            ) : (
              <Button onClick={goNext} disabled={!stepValid}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}