import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { newPersonCode } from "@/lib/refcode";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (person: { id: string; first_name: string; last_name: string; company: string | null }) => void;
  initialFullName?: string;
}

/**
 * Lightweight "add new person" dialog used inline from owner pickers and other
 * relationship selectors. People created here have no roles set — roles are
 * derived from the relationships they participate in.
 */
export function PersonQuickAddDialog({ open, onOpenChange, onCreated, initialFullName }: Props) {
  const splitName = (full: string) => {
    const parts = full.trim().split(/\s+/);
    return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
  };
  const seed = splitName(initialFullName ?? "");

  const [busy, setBusy] = useState(false);
  const [first, setFirst] = useState(seed.first);
  const [last, setLast] = useState(seed.last);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");

  // Reset when reopened
  const reset = () => {
    const s = splitName(initialFullName ?? "");
    setFirst(s.first); setLast(s.last);
    setPhone(""); setEmail(""); setCompany(""); setNotes("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!first.trim() || !last.trim()) {
      toast.error("First and last name are required.");
      return;
    }
    if (!phone.trim()) {
      toast.error("Phone number is required.");
      return;
    }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      ref_code: newPersonCode(),
      first_name: first.trim(),
      last_name: last.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      company: company.trim() || null,
      notes: notes.trim() || null,
      roles: [],
      created_by: u.user?.id,
    };
    const { data, error } = await supabase
      .from("people")
      .insert(payload)
      .select("id, first_name, last_name, company")
      .maybeSingle();
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not create person.");
      return;
    }
    toast.success("Person added.");
    onCreated(data as any);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add new person</DialogTitle>
          <DialogDescription>
            Quick-add. Roles will be inferred from the relationships you create. You can add more details later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="label-eyebrow">First name *</Label>
              <Input value={first} onChange={(e) => setFirst(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Last name *</Label>
              <Input value={last} onChange={(e) => setLast(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Phone *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+971…" />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="label-eyebrow">Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="label-eyebrow">Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Adding…" : "Add person"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}