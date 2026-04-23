import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Switch } from "@/components/ui/switch";
import { PersonCombobox, type PickedPerson } from "@/components/owners/PersonCombobox";
import { UnitPicker, type PickedUnit } from "@/components/contracts/UnitPicker";
import {
  COMMISSION_PAYER_LABEL,
  DEPOSIT_HOLDER_LABEL,
  PAYMENT_METHOD_LABEL,
  RENT_FREQUENCY_LABEL,
  type LeaseCommissionPayer,
  type LeaseDepositHolder,
  type LeasePaymentMethod,
  type LeaseRentFrequency,
} from "@/lib/contracts";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "unit", label: "Unit" },
  { key: "parties", label: "Parties" },
  { key: "rent", label: "Rent & Period" },
  { key: "deposit", label: "Deposit & Terms" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

interface FormState {
  title: string;
  unit: PickedUnit | null;
  landlord: PickedPerson | null;
  tenant: PickedPerson | null;
  pmCompany: PickedPerson | null;
  startDate: string;
  endDate: string;
  signedDate: string;
  currency: string;
  rentAmount: string;
  rentFrequency: LeaseRentFrequency;
  numberOfCheques: string;
  paymentMethod: LeasePaymentMethod;
  rentFreeDays: string;
  gracePeriodDays: string;
  securityDeposit: string;
  securityDepositHeldBy: LeaseDepositHolder;
  commissionAmount: string;
  commissionPaidBy: LeaseCommissionPayer;
  ejariNumber: string;
  ejariRegisteredDate: string;
  autoRenew: boolean;
  renewalNoticeDays: string;
  terminationNoticeDays: string;
  earlyTerminationPenalty: string;
  paymentNotes: string;
  scopeNotes: string;
}

const INITIAL: FormState = {
  title: "",
  unit: null,
  landlord: null,
  tenant: null,
  pmCompany: null,
  startDate: "",
  endDate: "",
  signedDate: "",
  currency: "AED",
  rentAmount: "",
  rentFrequency: "annual",
  numberOfCheques: "4",
  paymentMethod: "cheque",
  rentFreeDays: "0",
  gracePeriodDays: "5",
  securityDeposit: "",
  securityDepositHeldBy: "pm_company",
  commissionAmount: "",
  commissionPaidBy: "tenant",
  ejariNumber: "",
  ejariRegisteredDate: "",
  autoRenew: false,
  renewalNoticeDays: "90",
  terminationNoticeDays: "90",
  earlyTerminationPenalty: "",
  paymentNotes: "",
  scopeNotes: "",
};

export default function NewLease() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [saving, setSaving] = useState(false);

  // Auto-fill PM company + optionally pre-pick unit from URL ?unit=<id>
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
      const unitId = params.get("unit");
      if (unitId) {
        const { data: u } = await supabase
          .from("units")
          .select("id, unit_number, ref_code, building_id, status, asking_rent, asking_rent_currency, building:buildings(name)")
          .eq("id", unitId)
          .maybeSingle();
        if (u) {
          setForm((f) => ({
            ...f,
            unit: {
              id: u.id,
              unit_number: u.unit_number,
              ref_code: u.ref_code,
              building_id: u.building_id,
              building_name: (u as any).building?.name ?? "—",
              status: u.status,
              asking_rent: u.asking_rent,
              asking_rent_currency: u.asking_rent_currency,
            },
            rentAmount: u.asking_rent ? String(u.asking_rent) : f.rentAmount,
            currency: u.asking_rent_currency || f.currency,
          }));
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When unit picked, pre-fill landlord from primary owner if not set
  useEffect(() => {
    if (!form.unit || form.landlord) return;
    (async () => {
      const { data } = await supabase.rpc("resolve_unit_owners", { _unit_id: form.unit!.id });
      const primary = (data ?? []).find((o: any) => o.is_primary) ?? (data ?? [])[0];
      if (primary?.person_id) {
        const { data: p } = await supabase
          .from("people")
          .select("id, first_name, last_name, company")
          .eq("id", primary.person_id)
          .maybeSingle();
        if (p) setForm((f) => ({ ...f, landlord: p as PickedPerson }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.unit?.id]);

  const step = STEPS[stepIndex];
  const update = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const stepValid = useMemo(() => {
    switch (step.key) {
      case "unit":
        return !!form.unit;
      case "parties":
        return !!form.landlord && !!form.tenant;
      case "rent":
        return !!form.startDate && !!form.endDate && !!form.rentAmount && Number(form.rentAmount) > 0;
      case "deposit":
        return true;
    }
  }, [step, form]);

  const goNext = () => stepValid && stepIndex < STEPS.length - 1 && setStepIndex(stepIndex + 1);
  const goBack = () => stepIndex > 0 && setStepIndex(stepIndex - 1);

  const save = async (asActive: boolean) => {
    if (!form.unit || !form.landlord || !form.tenant) {
      toast.error("Pick the unit, landlord and tenant first.");
      return;
    }
    if (!form.startDate || !form.endDate || !form.rentAmount) {
      toast.error("Start date, end date and rent are required.");
      return;
    }
    setSaving(true);
    try {
      const year = new Date().getFullYear();
      const { data: numData, error: numErr } = await supabase.rpc("next_number", {
        p_prefix: "LSE",
        p_year: year,
      });
      if (numErr) throw numErr;

      const { data: contract, error: cErr } = await supabase
        .from("contracts")
        .insert({
          contract_number: numData as string,
          contract_type: "lease",
          status: asActive ? "active" : "draft",
          title: form.title || null,
          start_date: form.startDate,
          end_date: form.endDate,
          signed_date: form.signedDate || null,
          currency: form.currency,
        })
        .select()
        .single();
      if (cErr) throw cErr;

      const parties = [
        { contract_id: contract.id, person_id: form.landlord.id, role: "landlord" as const, is_primary: true },
        { contract_id: contract.id, person_id: form.tenant.id, role: "tenant" as const, is_primary: true },
      ];
      if (form.pmCompany) {
        parties.push({ contract_id: contract.id, person_id: form.pmCompany.id, role: "pm_company" as const, is_primary: false });
      }
      const { error: pErr } = await supabase.from("contract_parties").insert(parties);
      if (pErr) throw pErr;

      const { error: sErr } = await supabase.from("contract_subjects").insert({
        contract_id: contract.id,
        subject_type: "unit",
        subject_id: form.unit.id,
      });
      if (sErr) throw sErr;

      const { error: lErr } = await supabase.from("leases").insert({
        contract_id: contract.id,
        unit_id: form.unit.id,
        rent_amount: Number(form.rentAmount),
        rent_frequency: form.rentFrequency,
        number_of_cheques: form.numberOfCheques ? Number(form.numberOfCheques) : null,
        payment_method: form.paymentMethod,
        security_deposit: form.securityDeposit ? Number(form.securityDeposit) : null,
        security_deposit_held_by: form.securityDepositHeldBy,
        commission_amount: form.commissionAmount ? Number(form.commissionAmount) : null,
        commission_paid_by: form.commissionPaidBy,
        ejari_number: form.ejariNumber || null,
        ejari_registered_date: form.ejariRegisteredDate || null,
        rent_free_days: form.rentFreeDays ? Number(form.rentFreeDays) : 0,
        grace_period_days: form.gracePeriodDays ? Number(form.gracePeriodDays) : 5,
        auto_renew: form.autoRenew,
        renewal_notice_days: form.renewalNoticeDays ? Number(form.renewalNoticeDays) : null,
        termination_notice_days: form.terminationNoticeDays ? Number(form.terminationNoticeDays) : null,
        early_termination_penalty: form.earlyTerminationPenalty || null,
        payment_notes: form.paymentNotes || null,
        scope_notes: form.scopeNotes || null,
      });
      if (lErr) throw lErr;

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
      toast.error(e.message || "Failed to save lease");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="New contract"
        title="Lease"
        description="Landlord ↔ Tenant. One unit, period, rent schedule, security deposit, Ejari registration."
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
        {step.key === "unit" && (
          <>
            <div>
              <Label htmlFor="title">Lease title (optional)</Label>
              <Input
                id="title"
                placeholder="e.g. Marina Heights 1203 — Khan Lease 2026"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Unit being leased</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">Pick a single unit. Landlord auto-fills from the unit's primary owner.</p>
              <UnitPicker value={form.unit} onChange={(u) => update("unit", u)} />
            </div>
          </>
        )}

        {step.key === "parties" && (
          <>
            <div className="grid md:grid-cols-2 gap-5">
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
                <p className="text-[11px] text-muted-foreground mt-1">Pre-filled from unit's primary owner when available.</p>
              </div>
              <div>
                <Label>Tenant</Label>
                <div className="mt-1.5">
                  <PersonCombobox
                    value={form.tenant?.id ?? ""}
                    valueLabel={
                      form.tenant
                        ? form.tenant.company || `${form.tenant.first_name} ${form.tenant.last_name}`
                        : ""
                    }
                    onChange={(p) => update("tenant", p)}
                    placeholder="Search or add tenant…"
                    roleFilter={["tenant", "prospect"]}
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>PM Company (optional, signs as agent)</Label>
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
              </div>
            </div>
          </>
        )}

        {step.key === "rent" && (
          <>
            <div className="grid md:grid-cols-3 gap-5">
              <div>
                <Label htmlFor="start">Start date</Label>
                <Input id="start" type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="end">End date</Label>
                <Input id="end" type="date" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="signed">Signed date (optional)</Label>
                <Input id="signed" type="date" value={form.signedDate} onChange={(e) => update("signedDate", e.target.value)} className="mt-1.5" />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              <div>
                <Label htmlFor="rent">Rent amount</Label>
                <Input
                  id="rent"
                  type="number"
                  value={form.rentAmount}
                  onChange={(e) => update("rentAmount", e.target.value)}
                  className="mt-1.5"
                  placeholder="e.g. 120000"
                />
              </div>
              <div>
                <Label>Frequency</Label>
                <Select value={form.rentFrequency} onValueChange={(v) => update("rentFrequency", v as LeaseRentFrequency)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RENT_FREQUENCY_LABEL) as LeaseRentFrequency[]).map((k) => (
                      <SelectItem key={k} value={k}>{RENT_FREQUENCY_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Currency</Label>
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

            <div className="grid md:grid-cols-3 gap-5">
              <div>
                <Label htmlFor="cheques">Number of cheques / installments</Label>
                <Input
                  id="cheques"
                  type="number"
                  value={form.numberOfCheques}
                  onChange={(e) => update("numberOfCheques", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Payment method</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => update("paymentMethod", v as LeasePaymentMethod)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PAYMENT_METHOD_LABEL) as LeasePaymentMethod[]).map((k) => (
                      <SelectItem key={k} value={k}>{PAYMENT_METHOD_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rentFree">Rent-free days (fit-out)</Label>
                <Input
                  id="rentFree"
                  type="number"
                  value={form.rentFreeDays}
                  onChange={(e) => update("rentFreeDays", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="payNotes">Payment notes (optional)</Label>
              <Textarea
                id="payNotes"
                rows={2}
                value={form.paymentNotes}
                onChange={(e) => update("paymentNotes", e.target.value)}
                placeholder="Cheque dates, bank account, etc."
                className="mt-1.5"
              />
            </div>
          </>
        )}

        {step.key === "deposit" && (
          <>
            <div className="grid md:grid-cols-3 gap-5">
              <div>
                <Label htmlFor="deposit">Security deposit ({form.currency})</Label>
                <Input
                  id="deposit"
                  type="number"
                  value={form.securityDeposit}
                  onChange={(e) => update("securityDeposit", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Deposit held by</Label>
                <RadioGroup
                  value={form.securityDepositHeldBy}
                  onValueChange={(v) => update("securityDepositHeldBy", v as LeaseDepositHolder)}
                  className="mt-2 space-y-1.5"
                >
                  {(Object.keys(DEPOSIT_HOLDER_LABEL) as LeaseDepositHolder[]).map((k) => (
                    <label
                      key={k}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-1.5 border hairline rounded-sm cursor-pointer text-xs",
                        form.securityDepositHeldBy === k ? "border-architect bg-muted/40" : "hover:bg-muted/30",
                      )}
                    >
                      <RadioGroupItem value={k} />
                      <span>{DEPOSIT_HOLDER_LABEL[k]}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div>
                <Label htmlFor="grace">Grace period for late payment (days)</Label>
                <Input
                  id="grace"
                  type="number"
                  value={form.gracePeriodDays}
                  onChange={(e) => update("gracePeriodDays", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              <div>
                <Label htmlFor="comm">Commission ({form.currency})</Label>
                <Input
                  id="comm"
                  type="number"
                  value={form.commissionAmount}
                  onChange={(e) => update("commissionAmount", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Commission paid by</Label>
                <Select value={form.commissionPaidBy} onValueChange={(v) => update("commissionPaidBy", v as LeaseCommissionPayer)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(COMMISSION_PAYER_LABEL) as LeaseCommissionPayer[]).map((k) => (
                      <SelectItem key={k} value={k}>{COMMISSION_PAYER_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <Label htmlFor="ejari">Ejari registration number (optional)</Label>
                <Input
                  id="ejari"
                  value={form.ejariNumber}
                  onChange={(e) => update("ejariNumber", e.target.value)}
                  className="mt-1.5"
                  placeholder="e.g. 0123456789"
                />
              </div>
              <div>
                <Label htmlFor="ejariDate">Ejari registered on (optional)</Label>
                <Input
                  id="ejariDate"
                  type="date"
                  value={form.ejariRegisteredDate}
                  onChange={(e) => update("ejariRegisteredDate", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
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
              <div>
                <Label htmlFor="penalty">Early termination penalty (optional)</Label>
                <Input
                  id="penalty"
                  value={form.earlyTerminationPenalty}
                  onChange={(e) => update("earlyTerminationPenalty", e.target.value)}
                  className="mt-1.5"
                  placeholder="e.g. 2 months rent"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 border hairline rounded-sm">
              <Switch checked={form.autoRenew} onCheckedChange={(v) => update("autoRenew", v)} />
              <div className="flex-1">
                <div className="text-sm text-architect">Auto-renew at end date</div>
                <div className="text-[11px] text-muted-foreground">Lease rolls over for another term unless either party gives notice.</div>
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
              <Label htmlFor="scope">Additional scope notes (optional)</Label>
              <Textarea
                id="scope"
                rows={3}
                value={form.scopeNotes}
                onChange={(e) => update("scopeNotes", e.target.value)}
                className="mt-1.5"
                placeholder="House rules, included furniture, special clauses…"
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
            <Button
              variant="ghost"
              onClick={() => save(false)}
              disabled={saving || !form.unit || !form.landlord || !form.tenant || !form.startDate || !form.endDate || !form.rentAmount}
            >
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
