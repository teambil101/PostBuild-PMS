import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PersonCombobox, type PickedPerson } from "@/components/owners/PersonCombobox";
import {
  SPECIALTIES, SPECIALTY_LABELS, SPECIALTY_ICONS, VENDOR_STATUSES,
  VENDOR_STATUS_LABELS, VENDOR_CURRENCIES, TRADE_LICENSE_AUTHORITIES,
  parseSpecialties, type Specialty, type VendorStatus, type VendorType,
} from "@/lib/vendors";

interface VendorEditable {
  id: string;
  legal_name: string;
  display_name: string | null;
  vendor_type: VendorType;
  trade_license_number: string | null;
  trade_license_authority: string | null;
  trade_license_expiry_date: string | null;
  trn: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  insurance_expiry_date: string | null;
  insurance_coverage_notes: string | null;
  primary_phone: string | null;
  primary_email: string | null;
  website: string | null;
  address: string | null;
  specialties: unknown;
  specialties_other: string | null;
  default_hourly_rate: number | null;
  default_call_out_fee: number | null;
  currency: string;
  rate_notes: string | null;
  service_area_notes: string | null;
  status: VendorStatus;
  is_preferred: boolean;
  onboarded_at: string | null;
  notes: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: VendorEditable | null;
  onSaved?: (vendorId: string) => void;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export function NewVendorDialog({ open, onOpenChange, vendor, onSaved }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEdit = !!vendor;
  const [saving, setSaving] = useState(false);

  // Form state
  const [vendorType, setVendorType] = useState<VendorType>("company");
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState("");
  const [tradeLicenseAuthority, setTradeLicenseAuthority] = useState("");
  const [tradeLicenseExpiry, setTradeLicenseExpiry] = useState("");
  const [trn, setTrn] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePolicy, setInsurancePolicy] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [insuranceNotes, setInsuranceNotes] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [specialties, setSpecialties] = useState<Set<Specialty>>(new Set());
  const [specialtiesOther, setSpecialtiesOther] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [callOutFee, setCallOutFee] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [rateNotes, setRateNotes] = useState("");
  const [serviceAreaNotes, setServiceAreaNotes] = useState("");
  const [status, setStatus] = useState<VendorStatus>("active");
  const [isPreferred, setIsPreferred] = useState(false);
  const [onboardedAt, setOnboardedAt] = useState(todayStr());
  const [notes, setNotes] = useState("");

  // Initial contact (create mode only)
  const [contactPerson, setContactPerson] = useState<PickedPerson | null>(null);

  useEffect(() => {
    if (!open) return;
    if (vendor) {
      setVendorType(vendor.vendor_type);
      setLegalName(vendor.legal_name);
      setDisplayName(vendor.display_name ?? "");
      setTradeLicenseNumber(vendor.trade_license_number ?? "");
      setTradeLicenseAuthority(vendor.trade_license_authority ?? "");
      setTradeLicenseExpiry(vendor.trade_license_expiry_date ?? "");
      setTrn(vendor.trn ?? "");
      setInsuranceProvider(vendor.insurance_provider ?? "");
      setInsurancePolicy(vendor.insurance_policy_number ?? "");
      setInsuranceExpiry(vendor.insurance_expiry_date ?? "");
      setInsuranceNotes(vendor.insurance_coverage_notes ?? "");
      setPrimaryPhone(vendor.primary_phone ?? "");
      setPrimaryEmail(vendor.primary_email ?? "");
      setWebsite(vendor.website ?? "");
      setAddress(vendor.address ?? "");
      setSpecialties(new Set(parseSpecialties(vendor.specialties)));
      setSpecialtiesOther(vendor.specialties_other ?? "");
      setHourlyRate(vendor.default_hourly_rate?.toString() ?? "");
      setCallOutFee(vendor.default_call_out_fee?.toString() ?? "");
      setCurrency(vendor.currency || "AED");
      setRateNotes(vendor.rate_notes ?? "");
      setServiceAreaNotes(vendor.service_area_notes ?? "");
      setStatus(vendor.status);
      setIsPreferred(vendor.is_preferred);
      setOnboardedAt(vendor.onboarded_at ?? todayStr());
      setNotes(vendor.notes ?? "");
      setContactPerson(null);
    } else {
      setVendorType("company");
      setLegalName("");
      setDisplayName("");
      setTradeLicenseNumber("");
      setTradeLicenseAuthority("");
      setTradeLicenseExpiry("");
      setTrn("");
      setInsuranceProvider("");
      setInsurancePolicy("");
      setInsuranceExpiry("");
      setInsuranceNotes("");
      setPrimaryPhone("");
      setPrimaryEmail("");
      setWebsite("");
      setAddress("");
      setSpecialties(new Set());
      setSpecialtiesOther("");
      setHourlyRate("");
      setCallOutFee("");
      setCurrency("AED");
      setRateNotes("");
      setServiceAreaNotes("");
      setStatus("active");
      setIsPreferred(false);
      setOnboardedAt(todayStr());
      setNotes("");
      setContactPerson(null);
    }
  }, [open, vendor]);

  const toggleSpecialty = (s: Specialty) => {
    const next = new Set(specialties);
    if (next.has(s)) next.delete(s); else next.add(s);
    setSpecialties(next);
  };

  const validation = useMemo(() => {
    const errs: string[] = [];
    if (!legalName.trim() || legalName.trim().length < 2) errs.push("Legal name is required (min 2 chars).");
    if (legalName.trim().length > 200) errs.push("Legal name too long.");
    if (hourlyRate && Number(hourlyRate) < 0) errs.push("Hourly rate must be ≥ 0.");
    if (callOutFee && Number(callOutFee) < 0) errs.push("Call-out fee must be ≥ 0.");
    if (!isEdit && vendorType === "individual" && !contactPerson) {
      errs.push("Individual vendors require a primary contact person.");
    }
    if (specialties.has("other") && !specialtiesOther.trim()) {
      errs.push("Describe the 'Other' specialty.");
    }
    return errs;
  }, [legalName, hourlyRate, callOutFee, vendorType, contactPerson, isEdit, specialties, specialtiesOther]);

  const handleSubmit = async () => {
    if (validation.length) {
      toast.error(validation[0]);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        legal_name: legalName.trim(),
        display_name: displayName.trim() || null,
        vendor_type: vendorType,
        trade_license_number: tradeLicenseNumber.trim() || null,
        trade_license_authority: tradeLicenseAuthority.trim() || null,
        trade_license_expiry_date: tradeLicenseExpiry || null,
        trn: trn.trim() || null,
        insurance_provider: insuranceProvider.trim() || null,
        insurance_policy_number: insurancePolicy.trim() || null,
        insurance_expiry_date: insuranceExpiry || null,
        insurance_coverage_notes: insuranceNotes.trim() || null,
        primary_phone: primaryPhone.trim() || null,
        primary_email: primaryEmail.trim() || null,
        website: website.trim() || null,
        address: address.trim() || null,
        specialties: Array.from(specialties),
        specialties_other: specialties.has("other") ? specialtiesOther.trim() || null : null,
        default_hourly_rate: hourlyRate ? Number(hourlyRate) : null,
        default_call_out_fee: callOutFee ? Number(callOutFee) : null,
        currency,
        rate_notes: rateNotes.trim() || null,
        service_area_notes: serviceAreaNotes.trim() || null,
        status,
        is_preferred: isPreferred,
        onboarded_at: onboardedAt || null,
        notes: notes.trim() || null,
      };

      let vendorId: string;

      if (isEdit && vendor) {
        const { error } = await supabase
          .from("vendors")
          .update(payload)
          .eq("id", vendor.id);
        if (error) throw error;
        vendorId = vendor.id;
        toast.success("Vendor updated");
      } else {
        // Generate vendor number
        const year = new Date().getFullYear();
        const { data: numData, error: numErr } = await supabase
          .rpc("next_number", { p_prefix: "VND", p_year: year });
        if (numErr) throw numErr;

        const { data: ins, error: insErr } = await supabase
          .from("vendors")
          .insert({
            ...payload,
            vendor_number: numData as string,
            created_by: user?.id ?? null,
            onboarded_by: user?.id ?? null,
          })
          .select("id, vendor_number")
          .single();
        if (insErr) throw insErr;
        vendorId = ins.id;

        if (contactPerson) {
          const { error: cErr } = await supabase
            .from("vendor_contacts")
            .insert({
              vendor_id: vendorId,
              person_id: contactPerson.id,
              role: "primary",
              is_primary: true,
            });
          if (cErr) {
            console.error(cErr);
            toast.warning("Vendor created but contact link failed.");
          }
        }
        toast.success(`Vendor ${ins.vendor_number} added`);
      }

      onOpenChange(false);
      if (onSaved) onSaved(vendorId);
      else if (!isEdit) navigate(`/vendors/${vendorId}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Failed to save vendor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit vendor" : "New vendor"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update vendor details, compliance, and rates."
              : "Add a specialist or contractor to your directory."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Section 1: Type & identity */}
          <Section title="Type & identity">
            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Vendor type *</Label>
                <div className="flex gap-2 mt-1.5">
                  {(["company", "individual"] as VendorType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={isEdit}
                      onClick={() => setVendorType(t)}
                      className={cn(
                        "flex-1 px-3 py-2 border hairline rounded-sm text-sm uppercase tracking-wider transition-colors",
                        vendorType === t
                          ? "bg-architect text-chalk border-architect"
                          : "bg-card text-muted-foreground hover:bg-muted/40",
                        isEdit && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      {t === "company" ? "Company" : "Individual"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="legal_name">Legal name *</Label>
                  <Input
                    id="legal_name"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder={vendorType === "company" ? "e.g. ABC Maintenance LLC" : "e.g. Ahmed Khan"}
                    maxLength={200}
                  />
                </div>
                <div>
                  <Label htmlFor="display_name">Display name</Label>
                  <Input
                    id="display_name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Short name (optional)"
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* Section 2: Compliance */}
          <Section title="Compliance & registration" subtitle={vendorType === "individual" ? "Optional for individuals" : undefined}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tl_num">Trade license #</Label>
                <Input id="tl_num" value={tradeLicenseNumber} onChange={(e) => setTradeLicenseNumber(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="tl_auth">License authority</Label>
                <Input
                  id="tl_auth"
                  value={tradeLicenseAuthority}
                  onChange={(e) => setTradeLicenseAuthority(e.target.value)}
                  list="tl-authorities"
                  placeholder="e.g. DED Dubai"
                />
                <datalist id="tl-authorities">
                  {TRADE_LICENSE_AUTHORITIES.map((a) => <option key={a} value={a} />)}
                </datalist>
              </div>
              <div>
                <Label htmlFor="tl_exp">License expiry</Label>
                <Input id="tl_exp" type="date" value={tradeLicenseExpiry} onChange={(e) => setTradeLicenseExpiry(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="trn">TRN</Label>
                <Input id="trn" value={trn} onChange={(e) => setTrn(e.target.value)} placeholder="VAT registration #" />
              </div>
              <div>
                <Label htmlFor="ins_prov">Insurance provider</Label>
                <Input id="ins_prov" value={insuranceProvider} onChange={(e) => setInsuranceProvider(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ins_pol">Insurance policy #</Label>
                <Input id="ins_pol" value={insurancePolicy} onChange={(e) => setInsurancePolicy(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ins_exp">Insurance expiry</Label>
                <Input id="ins_exp" type="date" value={insuranceExpiry} onChange={(e) => setInsuranceExpiry(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="ins_notes">Coverage notes</Label>
                <Textarea id="ins_notes" rows={2} value={insuranceNotes} onChange={(e) => setInsuranceNotes(e.target.value)} />
              </div>
            </div>
          </Section>

          {/* Section 3: Specialties */}
          <Section title="Specialties">
            <div className="grid grid-cols-3 gap-1.5">
              {SPECIALTIES.map((s) => {
                const Icon = SPECIALTY_ICONS[s];
                const active = specialties.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpecialty(s)}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1.5 border hairline rounded-sm text-xs transition-colors",
                      active
                        ? "bg-architect text-chalk border-architect"
                        : "bg-card text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {SPECIALTY_LABELS[s]}
                  </button>
                );
              })}
            </div>
            {specialties.has("other") && (
              <div className="mt-3">
                <Label htmlFor="spec_other">Describe other specialty *</Label>
                <Input id="spec_other" value={specialtiesOther} onChange={(e) => setSpecialtiesOther(e.target.value)} />
              </div>
            )}
          </Section>

          {/* Section 4: Contact basics */}
          <Section title="Contact basics">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="phone">Primary phone</Label>
                <Input id="phone" value={primaryPhone} onChange={(e) => setPrimaryPhone(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="email">Primary email</Label>
                <Input id="email" type="email" value={primaryEmail} onChange={(e) => setPrimaryEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </div>
          </Section>

          {/* Section 5: Rates */}
          <Section title="Rates">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="rate">Hourly rate</Label>
                <Input id="rate" type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="callout">Call-out fee</Label>
                <Input id="callout" type="number" min="0" step="0.01" value={callOutFee} onChange={(e) => setCallOutFee(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ccy">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="ccy"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VENDOR_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3">
              <Label htmlFor="rate_notes">Rate notes</Label>
              <Textarea
                id="rate_notes"
                rows={2}
                value={rateNotes}
                onChange={(e) => setRateNotes(e.target.value)}
                placeholder="Weekday/weekend differences, minimum hours, materials markup, etc."
              />
            </div>
          </Section>

          {/* Section 6: Service area & status */}
          <Section title="Service area & status">
            <div>
              <Label htmlFor="area">Service area notes</Label>
              <Textarea id="area" rows={2} value={serviceAreaNotes} onChange={(e) => setServiceAreaNotes(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as VendorStatus)}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VENDOR_STATUSES.filter((s) => s !== "blacklisted").map((s) => (
                      <SelectItem key={s} value={s}>{VENDOR_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="onboarded">Onboarded date</Label>
                <Input id="onboarded" type="date" value={onboardedAt} onChange={(e) => setOnboardedAt(e.target.value)} />
              </div>
              <div className="flex flex-col">
                <Label className="mb-1.5">Preferred</Label>
                <div className="flex items-center gap-2 h-9">
                  <Switch checked={isPreferred} onCheckedChange={setIsPreferred} />
                  {isPreferred && <Star className="h-4 w-4 fill-gold text-gold" />}
                </div>
              </div>
            </div>
          </Section>

          {/* Section 7: Initial contact (create only) */}
          {!isEdit && (
            <Section
              title="Initial contact"
              subtitle={vendorType === "individual" ? "Required — link this handyman's person record" : "Optional — add the vendor's primary contact"}
            >
              <PersonCombobox
                value={contactPerson?.id ?? ""}
                valueLabel={contactPerson ? `${contactPerson.first_name} ${contactPerson.last_name}` : undefined}
                onChange={(p) => setContactPerson(p)}
                placeholder={vendorType === "individual" ? "Find or create person…" : "Add primary contact (optional)…"}
                invalid={vendorType === "individual" && !contactPerson}
              />
            </Section>
          )}

          {/* Section 8: Notes */}
          <Section title="Notes">
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              placeholder="Anything else worth remembering about this vendor."
            />
          </Section>

          {validation.length > 0 && (
            <div className="border border-destructive/30 bg-destructive/5 text-destructive text-xs p-3 rounded-sm">
              {validation.map((err) => <div key={err}>• {err}</div>)}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="gold" onClick={handleSubmit} disabled={saving || validation.length > 0}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {isEdit ? "Save changes" : "Add vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title, subtitle, children,
}: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2">
        <div className="label-eyebrow">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}
