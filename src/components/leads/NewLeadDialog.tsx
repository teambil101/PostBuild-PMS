import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { PersonCombobox, type PickedPerson } from "@/components/owners/PersonCombobox";
import {
  LEAD_SOURCES, LEAD_SOURCE_LABELS, LEAD_SOURCE_DETAIL_HELPERS,
  type LeadSource, type LeadRow,
} from "@/lib/leads";
import {
  FEE_MODELS, FEE_MODEL_LABELS, type FeeModel,
  SCOPE_OF_SERVICES, SCOPE_LABELS, type ScopeService,
} from "@/lib/contracts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Edit mode — pass an existing lead. */
  editLead?: LeadRow | null;
  onSaved?: (leadId: string) => void;
}

export function NewLeadDialog({ open, onOpenChange, editLead, onSaved }: Props) {
  const navigate = useNavigate();
  const isEdit = !!editLead;
  const [busy, setBusy] = useState(false);

  // identity
  const [primaryContact, setPrimaryContact] = useState<PickedPerson | null>(null);
  const [company, setCompany] = useState<PickedPerson | null>(null);

  // source
  const [source, setSource] = useState<LeadSource>("inbound");
  const [sourceDetails, setSourceDetails] = useState("");

  // sizing
  const [propertyCount, setPropertyCount] = useState("");
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [estimatedFee, setEstimatedFee] = useState("");
  const [probability, setProbability] = useState(30);
  const [targetCloseDate, setTargetCloseDate] = useState("");

  // proposed terms
  const [feeModel, setFeeModel] = useState<FeeModel | "">("");
  const [feeValue, setFeeValue] = useState("");
  const [feeAppliesTo, setFeeAppliesTo] = useState<"contracted_rent" | "collected_rent">("contracted_rent");
  const [proposedDuration, setProposedDuration] = useState("12");
  const [scope, setScope] = useState<ScopeService[]>([]);
  const [proposedTermsNotes, setProposedTermsNotes] = useState("");

  // assignment + notes
  const [assignee, setAssignee] = useState<PickedPerson | null>(null);
  const [initialNotes, setInitialNotes] = useState("");

  // Reset / pre-fill
  useEffect(() => {
    if (!open) return;
    if (editLead) {
      // Pre-fill from editLead. People are loaded async.
      setSource(editLead.source);
      setSourceDetails(editLead.source_details ?? "");
      setPropertyCount(editLead.property_count_estimated?.toString() ?? "");
      setPortfolioDescription(editLead.portfolio_description ?? "");
      setEstimatedFee(editLead.estimated_annual_fee?.toString() ?? "");
      setProbability(editLead.probability_percent ?? 30);
      setTargetCloseDate(editLead.target_close_date ?? "");
      setFeeModel((editLead.proposed_fee_model as FeeModel | null) ?? "");
      setFeeValue(editLead.proposed_fee_value?.toString() ?? "");
      setFeeAppliesTo((editLead.proposed_fee_applies_to as any) ?? "contracted_rent");
      setProposedDuration(editLead.proposed_duration_months?.toString() ?? "12");
      setScope((editLead.proposed_scope_of_services ?? []) as ScopeService[]);
      setProposedTermsNotes(editLead.proposed_terms_notes ?? "");
      setInitialNotes(editLead.notes ?? "");

      const ids = [editLead.primary_contact_id, editLead.company_id, editLead.assignee_id].filter(Boolean) as string[];
      if (ids.length) {
        supabase.from("people").select("id, first_name, last_name, company").in("id", ids).then(({ data }) => {
          const list = (data ?? []) as PickedPerson[];
          const map = Object.fromEntries(list.map((p) => [p.id, p]));
          setPrimaryContact(map[editLead.primary_contact_id] ?? null);
          setCompany(editLead.company_id ? map[editLead.company_id] ?? null : null);
          setAssignee(editLead.assignee_id ? map[editLead.assignee_id] ?? null : null);
        });
      }
    } else {
      setPrimaryContact(null);
      setCompany(null);
      setSource("inbound");
      setSourceDetails("");
      setPropertyCount("");
      setPortfolioDescription("");
      setEstimatedFee("");
      setProbability(30);
      setTargetCloseDate("");
      setFeeModel("");
      setFeeValue("");
      setFeeAppliesTo("contracted_rent");
      setProposedDuration("12");
      setScope([]);
      setProposedTermsNotes("");
      setAssignee(null);
      setInitialNotes("");
    }
  }, [open, editLead]);

  const sourceHelper = useMemo(() => LEAD_SOURCE_DETAIL_HELPERS[source], [source]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const targetInPast = targetCloseDate && targetCloseDate < todayIso;

  const valid =
    !!primaryContact &&
    !!source &&
    probability >= 0 && probability <= 100 &&
    !targetInPast;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      toast.error("Please complete required fields.");
      return;
    }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();

    const payloadBase = {
      primary_contact_id: primaryContact!.id,
      company_id: company?.id ?? null,
      source,
      source_details: sourceDetails.trim() || null,
      property_count_estimated: propertyCount ? Number(propertyCount) : null,
      portfolio_description: portfolioDescription.trim() || null,
      estimated_annual_fee: estimatedFee ? Number(estimatedFee) : null,
      probability_percent: probability,
      target_close_date: targetCloseDate || null,
      proposed_fee_model: feeModel || null,
      proposed_fee_value: feeValue ? Number(feeValue) : null,
      proposed_fee_applies_to: feeModel === "percentage_of_rent" ? feeAppliesTo : null,
      proposed_duration_months: proposedDuration ? Number(proposedDuration) : null,
      proposed_scope_of_services: scope,
      proposed_terms_notes: proposedTermsNotes.trim() || null,
      assignee_id: assignee?.id ?? null,
      notes: initialNotes.trim() || null,
    };

    if (isEdit && editLead) {
      const { error } = await supabase.from("leads").update(payloadBase as never).eq("id", editLead.id);
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Lead updated.");
      onOpenChange(false);
      onSaved?.(editLead.id);
      return;
    }

    // Create — generate lead_number
    const year = new Date().getFullYear();
    const { data: numRes, error: numErr } = await supabase.rpc("next_number", {
      p_prefix: "LEAD",
      p_year: year,
    });
    if (numErr || !numRes) {
      setBusy(false);
      toast.error("Could not generate lead number.");
      return;
    }

    // Get default currency
    const { data: settings } = await supabase
      .from("app_settings")
      .select("default_currency")
      .maybeSingle();
    const currency = settings?.default_currency ?? "AED";

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        ...payloadBase,
        lead_number: numRes,
        currency,
        status: "new",
        created_by: u.user?.id,
      } as never)
      .select("id, lead_number")
      .maybeSingle();

    setBusy(false);
    if (error || !lead) {
      toast.error(error?.message ?? "Could not create lead.");
      return;
    }
    toast.success(`Lead ${lead.lead_number} created.`);
    onOpenChange(false);
    onSaved?.(lead.id);
    navigate(`/leads/${lead.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {isEdit ? "Edit lead" : "New lead"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update structured details for this lead. Status changes use dedicated actions."
              : "Track a prospective management client through the pipeline."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-6 pt-2">
          {/* Section 1: Identity */}
          <Section title="Identity">
            <Field label="Primary contact *" hint="The landlord or decision-maker you're talking to.">
              <PersonCombobox
                value={primaryContact?.id ?? ""}
                valueLabel={primaryContact ? `${primaryContact.first_name} ${primaryContact.last_name}`.trim() : ""}
                onChange={setPrimaryContact}
                placeholder="Search people…"
                excludeRoles={["staff"]}
              />
            </Field>
            <Field label="Company" hint="Optional. If selected, the contact represents this company.">
              <PersonCombobox
                value={company?.id ?? ""}
                valueLabel={company ? (company.company || `${company.first_name} ${company.last_name}`.trim()) : ""}
                onChange={setCompany}
                placeholder="Search companies (or leave blank)…"
                excludeIds={primaryContact ? [primaryContact.id] : []}
                excludeRoles={["staff"]}
              />
            </Field>
          </Section>

          {/* Section 2: Source */}
          <Section title="Source">
            <Field label="Source *">
              <Select value={source} onValueChange={(v) => setSource(v as LeadSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{LEAD_SOURCE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Source details" hint={sourceHelper}>
              <Input
                value={sourceDetails}
                onChange={(e) => setSourceDetails(e.target.value)}
                placeholder={sourceHelper}
              />
            </Field>
          </Section>

          {/* Section 3: Sizing */}
          <Section title="Sizing" subtitle="All optional at intake — fill in as you learn.">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Property count (est.)">
                <Input
                  type="number" min={0} step={1}
                  value={propertyCount}
                  onChange={(e) => setPropertyCount(e.target.value)}
                />
              </Field>
              <Field label="Estimated annual fee">
                <Input
                  type="number" min={0} step="0.01"
                  value={estimatedFee}
                  onChange={(e) => setEstimatedFee(e.target.value)}
                  placeholder="e.g. 75000"
                />
              </Field>
            </div>
            <Field label="Portfolio description">
              <Textarea
                rows={2}
                value={portfolioDescription}
                onChange={(e) => setPortfolioDescription(e.target.value)}
                placeholder="What properties do they want managed?"
              />
            </Field>
            <Field label={`Probability — ${probability}%`}>
              <Slider
                value={[probability]}
                onValueChange={(v) => setProbability(v[0])}
                min={0} max={100} step={5}
              />
            </Field>
            <Field label="Target close date">
              <Input
                type="date"
                value={targetCloseDate}
                onChange={(e) => setTargetCloseDate(e.target.value)}
                min={todayIso}
              />
              {targetInPast && (
                <p className="text-xs text-destructive mt-1">Target close date can't be in the past.</p>
              )}
            </Field>
          </Section>

          {/* Section 4: Proposed terms */}
          <Section
            title="Proposed terms"
            subtitle="These become defaults when you eventually sign the management agreement. Leave blank if not yet discussed."
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fee model">
                <Select value={feeModel} onValueChange={(v) => setFeeModel(v as FeeModel)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {FEE_MODELS.map((m) => (
                      <SelectItem key={m} value={m}>{FEE_MODEL_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={feeModel === "percentage_of_rent" ? "Fee % " : "Fee value"}>
                <Input
                  type="number" min={0} step="0.01"
                  value={feeValue}
                  onChange={(e) => setFeeValue(e.target.value)}
                  disabled={!feeModel}
                />
              </Field>
            </div>
            {feeModel === "percentage_of_rent" && (
              <Field label="Fee applies to">
                <RadioGroup
                  value={feeAppliesTo}
                  onValueChange={(v) => setFeeAppliesTo(v as any)}
                  className="flex gap-4"
                >
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="contracted_rent" />
                    Contracted rent
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="collected_rent" />
                    Collected rent
                  </label>
                </RadioGroup>
              </Field>
            )}
            <Field label="Proposed duration (months)">
              <Input
                type="number" min={1} step={1}
                value={proposedDuration}
                onChange={(e) => setProposedDuration(e.target.value)}
              />
            </Field>
            <Field label="Proposed scope">
              <div className="grid grid-cols-2 gap-2 rounded-sm border hairline p-3 bg-muted/20">
                {SCOPE_OF_SERVICES.map((s) => {
                  const checked = scope.includes(s);
                  return (
                    <label key={s} className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          if (c) setScope([...scope, s]);
                          else setScope(scope.filter((x) => x !== s));
                        }}
                      />
                      {SCOPE_LABELS[s]}
                    </label>
                  );
                })}
              </div>
            </Field>
            <Field label="Proposed terms notes">
              <Textarea
                rows={2}
                value={proposedTermsNotes}
                onChange={(e) => setProposedTermsNotes(e.target.value)}
              />
            </Field>
          </Section>

          {/* Section 5: Assignment */}
          <Section title="Assignment">
            <Field label="Assignee" hint="Who's owning this deal? Search staff or leave unassigned.">
              <PersonCombobox
                value={assignee?.id ?? ""}
                valueLabel={assignee ? `${assignee.first_name} ${assignee.last_name}`.trim() : ""}
                onChange={setAssignee}
                placeholder="Unassigned"
                roleFilter={["staff"]}
                hideAddNew
              />
            </Field>
          </Section>

          {/* Section 6: Notes */}
          {!isEdit && (
            <Section title="Initial notes">
              <Textarea
                rows={3}
                value={initialNotes}
                onChange={(e) => setInitialNotes(e.target.value)}
                placeholder="Anything worth recording from the first conversation?"
              />
            </Section>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t hairline">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" disabled={busy || !valid}>
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {isEdit ? "Save changes" : "Create lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <div className="label-eyebrow text-architect">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
