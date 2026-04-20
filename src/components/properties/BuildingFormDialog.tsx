import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComboboxFree } from "@/components/ui/combobox-free";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { newBuildingCode } from "@/lib/refcode";
import { BUILDING_TYPES, COUNTRIES, UAE_CITIES, UAE_COMMUNITIES } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  initial?: any;
}

interface FormState {
  name: string;
  building_type: string;
  community: string;
  location_url: string;
  city: string;
  country: string; // ISO-2
}

const emptyForm = (): FormState => ({
  name: "",
  building_type: "residential_tower",
  community: "",
  location_url: "",
  city: "Dubai",
  country: "AE",
});

const fromInitial = (i: any): FormState => ({
  name: i?.name ?? "",
  building_type: i?.building_type ?? "residential_tower",
  community: i?.community ?? "",
  location_url: i?.location_url ?? "",
  city: i?.city ?? "Dubai",
  country: i?.country ?? "AE",
});

type Errors = Partial<Record<keyof FormState, string>>;

export function BuildingFormDialog({ open, onOpenChange, onSaved, initial }: Props) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [baseline, setBaseline] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLButtonElement>(null);
  const communityRef = useRef<HTMLDivElement>(null);
  const addressRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);
  const countryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      const next = initial ? fromInitial(initial) : emptyForm();
      setForm(next);
      setBaseline(next);
      setErrors({});
    }
  }, [open, initial]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  // Cities available in the dropdown depend on country.
  const cityOptions = form.country === "AE" ? UAE_CITIES : [];
  const communityOptions = form.country === "AE" ? UAE_COMMUNITIES : [];

  const validate = (): Errors => {
    const e: Errors = {};
    const name = form.name.trim();
    if (name.length < 2 || name.length > 120) {
      e.name = "Name must be 2–120 characters.";
    }
    if (!BUILDING_TYPES.some((t) => t.value === form.building_type)) {
      e.building_type = "Select a building type.";
    }
    if (form.community.trim().length > 80) {
      e.community = "Community must be 80 characters or fewer.";
    }
    if (form.address.trim().length < 3) {
      e.address = "Address is required (min 3 characters).";
    }
    if (form.city.trim().length === 0) {
      e.city = "City is required.";
    }
    if (!/^[A-Z]{2}$/.test(form.country)) {
      e.country = "Select a country.";
    }
    return e;
  };

  const focusFirstError = (e: Errors) => {
    const map: Partial<Record<keyof FormState, HTMLElement | null>> = {
      name: nameRef.current,
      building_type: typeRef.current,
      community: communityRef.current,
      address: addressRef.current,
      city: cityRef.current,
      country: countryRef.current,
    };
    const order: (keyof FormState)[] = ["name", "building_type", "community", "address", "city", "country"];
    const first = order.find((k) => e[k]);
    if (!first) return;
    const el = map[first];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as any).focus?.();
    }
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const v = validate();
    if (Object.keys(v).length > 0) {
      setErrors(v);
      focusFirstError(v);
      return;
    }
    setBusy(true);
    const payload: any = {
      name: form.name.trim(),
      building_type: form.building_type,
      community: form.community.trim() || null,
      address: form.address.trim(),
      address_formatted: form.address.trim(),
      latitude: form.latitude,
      longitude: form.longitude,
      place_id: form.place_id,
      city: form.city.trim(),
      country: form.country,
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
      return;
    }
    toast.success(initial?.id ? "Building updated" : "Building added");
    onSaved();
  };

  // Intercept close attempts when form is dirty.
  const handleOpenChange = (next: boolean) => {
    if (!next && isDirty && !busy) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(next);
  };

  const labelClass = "text-xs font-medium text-architect normal-case tracking-normal";
  const errorClass = "text-xs text-destructive mt-1";

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {initial?.id ? "Edit building" : "New building"}
            </DialogTitle>
            <DialogDescription>
              {initial?.id ? "Update building details." : "Add a building to your portfolio."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4 pt-2" noValidate>
            {/* Name */}
            <div>
              <Label htmlFor="b-name" className={labelClass}>
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="b-name"
                ref={nameRef}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Marina Heights Tower"
                maxLength={120}
                className={cn("mt-1.5", errors.name && "border-destructive")}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className={errorClass}>{errors.name}</p>}
            </div>

            {/* Building type */}
            <div>
              <Label htmlFor="b-type" className={labelClass}>
                Building type <span className="text-destructive">*</span>
              </Label>
              <Select value={form.building_type} onValueChange={(v) => set("building_type", v)}>
                <SelectTrigger
                  id="b-type"
                  ref={typeRef}
                  className={cn("mt-1.5", errors.building_type && "border-destructive")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUILDING_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.building_type && <p className={errorClass}>{errors.building_type}</p>}
            </div>

            {/* Community */}
            <div>
              <Label htmlFor="b-community" className={labelClass}>Community</Label>
              <div ref={communityRef} className="mt-1.5">
                <ComboboxFree
                  id="b-community"
                  value={form.community}
                  onChange={(v) => set("community", v)}
                  options={communityOptions}
                  placeholder="Search or type a community"
                  invalid={!!errors.community}
                />
              </div>
              {errors.community && <p className={errorClass}>{errors.community}</p>}
            </div>

            {/* Address */}
            <div>
              <Label htmlFor="b-address" className={labelClass}>
                Location <span className="text-destructive">*</span>
              </Label>
              <div ref={addressRef} className="mt-1.5">
                <PlacesAutocomplete
                  id="b-address"
                  value={form.address}
                  onChange={(v) => set("address", v)}
                  countryBias={form.country ? [form.country.toLowerCase()] : ["ae"]}
                  placeholder="Search a building, street, or landmark"
                  invalid={!!errors.address}
                  onPlaceSelected={(p) => {
                    setForm((f) => ({
                      ...f,
                      address: p.address_formatted,
                      latitude: p.latitude,
                      longitude: p.longitude,
                      place_id: p.place_id,
                      city: p.city ?? f.city,
                      country: p.country ?? f.country,
                      community: p.community ?? f.community,
                    }));
                    setErrors((e) => ({ ...e, address: undefined, city: undefined, country: undefined }));
                  }}
                />
              </div>
              {form.latitude != null && form.longitude != null && (
                <p className="text-xs text-muted-foreground mt-1">
                  Pinned: {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                </p>
              )}
              {errors.address && <p className={errorClass}>{errors.address}</p>}
            </div>

            {/* City */}
            <div>
              <Label htmlFor="b-city" className={labelClass}>
                City <span className="text-destructive">*</span>
              </Label>
              <div ref={cityRef} className="mt-1.5">
                <ComboboxFree
                  id="b-city"
                  value={form.city}
                  onChange={(v) => set("city", v)}
                  options={cityOptions}
                  placeholder={cityOptions.length ? "Search or type a city" : "Type a city"}
                  invalid={!!errors.city}
                />
              </div>
              {errors.city && <p className={errorClass}>{errors.city}</p>}
            </div>

            {/* Country */}
            <div>
              <Label htmlFor="b-country" className={labelClass}>
                Country <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.country}
                onValueChange={(v) => {
                  setForm((f) => ({
                    ...f,
                    country: v,
                    city: v === "AE" && !f.city ? "Dubai" : f.city,
                  }));
                  setErrors((e) => ({ ...e, country: undefined }));
                }}
              >
                <SelectTrigger
                  id="b-country"
                  ref={countryRef}
                  className={cn("mt-1.5", errors.country && "border-destructive")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.country && <p className={errorClass}>{errors.country}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2 mt-2">
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold" disabled={busy}>
                {busy ? "Saving…" : initial?.id ? "Save changes" : "Create building"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Closing this form will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscard(false);
                onOpenChange(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}