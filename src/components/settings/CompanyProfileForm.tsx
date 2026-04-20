import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { newPersonCode } from "@/lib/refcode";
import { Loader2, Building2 } from "lucide-react";

interface Props {
  /** Optional callback after save (e.g. close modal, refetch). */
  onSaved?: () => void;
  /** When true, renders without the surrounding card (used inside the onboarding gate). */
  embedded?: boolean;
}

interface Form {
  company_name: string;
  trade_license_number: string;
  trade_license_authority: string;
  registered_address: string;
  phone: string;
  primary_email: string;
  authorized_signatory_name: string;
  authorized_signatory_title: string;
}

const empty: Form = {
  company_name: "",
  trade_license_number: "",
  trade_license_authority: "",
  registered_address: "",
  phone: "",
  primary_email: "",
  authorized_signatory_name: "",
  authorized_signatory_title: "",
};

/**
 * Edits the organisation's "self person" — the company that appears as the
 * service provider on management agreements / brokerage / service agreements.
 */
export function CompanyProfileForm({ onSaved, embedded }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selfPersonId, setSelfPersonId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);

  useEffect(() => {
    (async () => {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("self_person_id")
        .maybeSingle();
      const sid = settings?.self_person_id ?? null;
      setSelfPersonId(sid);
      if (sid) {
        const { data: p } = await supabase
          .from("people")
          .select("first_name, company, trade_license_number, trade_license_authority, registered_address, phone, primary_email, authorized_signatory_name, authorized_signatory_title")
          .eq("id", sid)
          .maybeSingle();
        if (p) {
          setForm({
            company_name: (p.company ?? p.first_name ?? "") as string,
            trade_license_number: p.trade_license_number ?? "",
            trade_license_authority: p.trade_license_authority ?? "",
            registered_address: p.registered_address ?? "",
            phone: p.phone ?? "",
            primary_email: p.primary_email ?? "",
            authorized_signatory_name: p.authorized_signatory_name ?? "",
            authorized_signatory_title: p.authorized_signatory_title ?? "",
          });
        }
      }
      setLoading(false);
    })();
  }, []);

  const update = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const required: (keyof Form)[] = [
      "company_name", "trade_license_number", "trade_license_authority",
      "registered_address", "phone", "primary_email",
      "authorized_signatory_name", "authorized_signatory_title",
    ];
    for (const k of required) {
      if (!form[k].trim()) {
        toast.error("All fields are required.");
        return;
      }
    }

    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const peoplePayload = {
      company: form.company_name.trim(),
      trade_license_number: form.trade_license_number.trim(),
      trade_license_authority: form.trade_license_authority.trim(),
      registered_address: form.registered_address.trim(),
      phone: form.phone.trim(),
      primary_email: form.primary_email.trim(),
      authorized_signatory_name: form.authorized_signatory_name.trim(),
      authorized_signatory_title: form.authorized_signatory_title.trim(),
    };

    if (selfPersonId) {
      const { error } = await supabase.from("people").update(peoplePayload).eq("id", selfPersonId);
      if (error) {
        setSaving(false);
        toast.error(error.message);
        return;
      }
    } else {
      // Create new self-person row
      const { data: created, error } = await supabase
        .from("people")
        .insert({
          ...peoplePayload,
          ref_code: newPersonCode(),
          first_name: form.company_name.trim(),
          last_name: "(Company)",
          person_type: "company",
          is_self: true,
          email: form.primary_email.trim() || null,
          roles: [],
          created_by: u.user?.id,
        })
        .select("id")
        .maybeSingle();
      if (error || !created) {
        setSaving(false);
        toast.error(error?.message ?? "Could not create company profile.");
        return;
      }
      // Update app_settings.self_person_id
      const { data: settings } = await supabase.from("app_settings").select("id").maybeSingle();
      if (settings) {
        await supabase.from("app_settings").update({ self_person_id: created.id }).eq("id", settings.id);
      } else {
        await supabase.from("app_settings").insert({ self_person_id: created.id });
      }
      setSelfPersonId(created.id);
    }

    setSaving(false);
    toast.success("Company profile saved.");
    onSaved?.();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const inner = (
    <form onSubmit={submit} className="space-y-5">
      {!embedded && (
        <div className="flex items-center gap-3 pb-2">
          <Building2 className="h-6 w-6 text-gold-deep" strokeWidth={1.4} />
          <div>
            <div className="font-display text-2xl text-architect">Company profile</div>
            <p className="text-sm text-muted-foreground">
              This entity appears as the service provider on every contract you issue.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 space-y-1.5">
          <Label className="label-eyebrow">Company name *</Label>
          <Input value={form.company_name} onChange={update("company_name")} required />
        </div>
        <div className="space-y-1.5">
          <Label className="label-eyebrow">Trade license number *</Label>
          <Input value={form.trade_license_number} onChange={update("trade_license_number")} required />
        </div>
        <div className="space-y-1.5">
          <Label className="label-eyebrow">Trade license authority *</Label>
          <Input
            value={form.trade_license_authority}
            onChange={update("trade_license_authority")}
            placeholder="DED Dubai, DMCC, ADGM…"
            required
          />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <Label className="label-eyebrow">Registered address *</Label>
          <Textarea
            rows={2}
            value={form.registered_address}
            onChange={update("registered_address")}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="label-eyebrow">Primary phone *</Label>
          <Input value={form.phone} onChange={update("phone")} placeholder="+971…" required />
        </div>
        <div className="space-y-1.5">
          <Label className="label-eyebrow">Primary email *</Label>
          <Input type="email" value={form.primary_email} onChange={update("primary_email")} required />
        </div>
        <div className="space-y-1.5">
          <Label className="label-eyebrow">Authorized signatory name *</Label>
          <Input
            value={form.authorized_signatory_name}
            onChange={update("authorized_signatory_name")}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="label-eyebrow">Signatory title *</Label>
          <Input
            value={form.authorized_signatory_title}
            onChange={update("authorized_signatory_title")}
            placeholder="Managing Director, GM…"
            required
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" variant="gold" disabled={saving}>
          {saving ? "Saving…" : selfPersonId ? "Save changes" : "Save and continue"}
        </Button>
      </div>
    </form>
  );

  if (embedded) return inner;
  return <div className="border hairline rounded-sm bg-card p-6">{inner}</div>;
}