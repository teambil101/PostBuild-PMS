import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { newUnitCode } from "@/lib/refcode";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  buildingId: string;
  initial?: any;
}

export function UnitFormDialog({ open, onOpenChange, onSaved, buildingId, initial }: Props) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({
    unit_number: "",
    unit_type: "apartment",
    status: "vacant",
    floor: "",
    size_sqm: "",
    bedrooms: "",
    bathrooms: "",
    monthly_rent: "",
    description: "",
  });

  useEffect(() => {
    if (open && initial) {
      setForm({
        unit_number: initial.unit_number ?? "",
        unit_type: initial.unit_type ?? "apartment",
        status: initial.status ?? "vacant",
        floor: initial.floor ?? "",
        size_sqm: initial.size_sqm ?? "",
        bedrooms: initial.bedrooms ?? "",
        bathrooms: initial.bathrooms ?? "",
        monthly_rent: initial.monthly_rent ?? "",
        description: initial.description ?? "",
      });
    } else if (open) {
      setForm({
        unit_number: "", unit_type: "apartment", status: "vacant",
        floor: "", size_sqm: "", bedrooms: "", bathrooms: "",
        monthly_rent: "", description: "",
      });
    }
  }, [open, initial]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unit_number.trim()) {
      toast.error("Unit number is required.");
      return;
    }
    setBusy(true);
    const payload: any = {
      building_id: buildingId,
      unit_number: form.unit_number.trim(),
      unit_type: form.unit_type,
      status: form.status,
      floor: form.floor !== "" ? Number(form.floor) : null,
      size_sqm: form.size_sqm !== "" ? Number(form.size_sqm) : null,
      bedrooms: form.bedrooms !== "" ? Number(form.bedrooms) : null,
      bathrooms: form.bathrooms !== "" ? Number(form.bathrooms) : null,
      monthly_rent: form.monthly_rent !== "" ? Number(form.monthly_rent) : null,
      description: form.description || null,
    };
    let error;
    if (initial?.id) {
      ({ error } = await supabase.from("units").update(payload).eq("id", initial.id));
    } else {
      const { data: u } = await supabase.auth.getUser();
      payload.ref_code = newUnitCode();
      payload.created_by = u.user?.id;
      ({ error } = await supabase.from("units").insert(payload));
    }
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(initial?.id ? "Unit updated." : "Unit added.");
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {initial?.id ? "Edit unit" : "New unit"}
          </DialogTitle>
          <DialogDescription>
            {initial?.id ? "Update unit details." : "Add a unit to this building."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Unit number *</Label>
              <Input value={form.unit_number} onChange={(e) => set("unit_number", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Type</Label>
              <Select value={form.unit_type} onValueChange={(v) => set("unit_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["studio", "apartment", "house", "office", "retail", "storage", "other"].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacant">Vacant</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="off_market">Off Market</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Floor</Label>
              <Input type="number" value={form.floor} onChange={(e) => set("floor", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Size (sqm)</Label>
              <Input type="number" step="0.01" value={form.size_sqm} onChange={(e) => set("size_sqm", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Monthly rent</Label>
              <Input type="number" step="0.01" value={form.monthly_rent} onChange={(e) => set("monthly_rent", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Bedrooms</Label>
              <Input type="number" value={form.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Bathrooms</Label>
              <Input type="number" step="0.5" value={form.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Saving…" : initial?.id ? "Save changes" : "Add unit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
