import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { newBuildingCode } from "@/lib/refcode";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  initial?: any;
}

export function BuildingFormDialog({ open, onOpenChange, onSaved, initial }: Props) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({
    name: "",
    description: "",
    address_line1: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    latitude: "",
    longitude: "",
    year_built: "",
    total_floors: "",
    cover_image_url: "",
  });

  useEffect(() => {
    if (open && initial) {
      setForm({
        name: initial.name ?? "",
        description: initial.description ?? "",
        address_line1: initial.address_line1 ?? "",
        city: initial.city ?? "",
        state: initial.state ?? "",
        postal_code: initial.postal_code ?? "",
        country: initial.country ?? "",
        latitude: initial.latitude ?? "",
        longitude: initial.longitude ?? "",
        year_built: initial.year_built ?? "",
        total_floors: initial.total_floors ?? "",
        cover_image_url: initial.cover_image_url ?? "",
      });
    } else if (open) {
      setForm({
        name: "", description: "", address_line1: "", city: "", state: "",
        postal_code: "", country: "", latitude: "", longitude: "",
        year_built: "", total_floors: "", cover_image_url: "",
      });
    }
  }, [open, initial]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Building name is required.");
      return;
    }
    setBusy(true);
    const payload: any = {
      name: form.name.trim(),
      description: form.description || null,
      address_line1: form.address_line1 || null,
      city: form.city || null,
      state: form.state || null,
      postal_code: form.postal_code || null,
      country: form.country || null,
      latitude: form.latitude !== "" ? Number(form.latitude) : null,
      longitude: form.longitude !== "" ? Number(form.longitude) : null,
      year_built: form.year_built !== "" ? Number(form.year_built) : null,
      total_floors: form.total_floors !== "" ? Number(form.total_floors) : null,
      cover_image_url: form.cover_image_url || null,
    };

    let error;
    if (initial?.id) {
      ({ error } = await supabase.from("buildings").update(payload).eq("id", initial.id));
    } else {
      const { data: u } = await supabase.auth.getUser();
      payload.ref_code = newBuildingCode();
      payload.created_by = u.user?.id;
      ({ error } = await supabase.from("buildings").insert(payload));
    }
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(initial?.id ? "Building updated." : "Building created.");
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {initial?.id ? "Edit building" : "New building"}
          </DialogTitle>
          <DialogDescription>
            {initial?.id ? "Update building details." : "Add a building to your portfolio. You can add units after."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Address line</Label>
            <Input value={form.address_line1} onChange={(e) => set("address_line1", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="label-eyebrow">City</Label>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">State / Region</Label>
              <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Postal code</Label>
              <Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Country</Label>
              <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Latitude</Label>
              <Input type="number" step="any" value={form.latitude} onChange={(e) => set("latitude", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Longitude</Label>
              <Input type="number" step="any" value={form.longitude} onChange={(e) => set("longitude", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Year built</Label>
              <Input type="number" value={form.year_built} onChange={(e) => set("year_built", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Total floors</Label>
              <Input type="number" value={form.total_floors} onChange={(e) => set("total_floors", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Cover image URL</Label>
            <Input value={form.cover_image_url} onChange={(e) => set("cover_image_url", e.target.value)} placeholder="https://…" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Saving…" : initial?.id ? "Save changes" : "Create building"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
