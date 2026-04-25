import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { newPersonCode } from "@/lib/refcode";

const ALL_ROLES = ["tenant", "owner", "staff", "vendor"] as const;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  initial?: any;
}

export function PersonFormDialog({ open, onOpenChange, onSaved, initial }: Props) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({
    first_name: "", last_name: "", email: "", phone: "",
    company: "", address: "", city: "", country: "",
    notes: "", roles: ["tenant"],
  });

  useEffect(() => {
    if (open && initial) {
      setForm({
        first_name: initial.first_name ?? "",
        last_name: initial.last_name ?? "",
        email: initial.email ?? "",
        phone: initial.phone ?? "",
        company: initial.company ?? "",
        address: initial.address ?? "",
        city: initial.city ?? "",
        country: initial.country ?? "",
        notes: initial.notes ?? "",
        roles: initial.roles ?? [],
      });
    } else if (open) {
      setForm({
        first_name: "", last_name: "", email: "", phone: "",
        company: "", address: "", city: "", country: "",
        notes: "", roles: ["tenant"],
      });
    }
  }, [open, initial]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const toggleRole = (r: string) => {
    set("roles", form.roles.includes(r) ? form.roles.filter((x: string) => x !== r) : [...form.roles, r]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("First and last name are required.");
      return;
    }
    if (form.roles.length === 0) {
      toast.error("Pick at least one role.");
      return;
    }
    setBusy(true);
    const payload: any = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      company: form.company || null,
      address: form.address || null,
      city: form.city || null,
      country: form.country || null,
      notes: form.notes || null,
      roles: form.roles,
    };

    let error;
    if (initial?.id) {
      ({ error } = await supabase.from("people").update(payload).eq("id", initial.id));
    } else {
      const { data: u } = await supabase.auth.getUser();
      payload.ref_code = newPersonCode();
      payload.created_by = u.user?.id;
      ({ error } = await supabase.from("people").insert(payload));
    }
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(initial?.id ? "Person updated." : "Person added.");
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {initial?.id ? "Edit person" : "New person"}
          </DialogTitle>
          <DialogDescription>
            {initial?.id ? "Update profile details." : "Add someone to your directory."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="label-eyebrow">First name *</Label>
              <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Last name *</Label>
              <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Phone</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="label-eyebrow">Company / Organization</Label>
              <Input value={form.company} onChange={(e) => set("company", e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="label-eyebrow">Address</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">City</Label>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Country</Label>
              <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="label-eyebrow">Roles *</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((r) => (
                <label
                  key={r}
                  className="flex items-center gap-2 px-3 py-1.5 border hairline rounded-sm cursor-pointer hover:bg-muted/40"
                >
                  <Checkbox checked={form.roles.includes(r)} onCheckedChange={() => toggleRole(r)} />
                  <span className="text-xs uppercase tracking-wider capitalize">{r}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="label-eyebrow">Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Saving…" : initial?.id ? "Save changes" : "Create person"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
