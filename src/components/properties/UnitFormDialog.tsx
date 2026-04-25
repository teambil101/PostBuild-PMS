import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Paperclip, ChevronDown, X as XIcon, FileText, Image as ImageIcon } from "lucide-react";
import { FileDropZone, validateFile } from "@/components/attachments/FileDropZone";
import {
  PHOTO_BUCKET, DOC_BUCKET, PHOTO_MIMES, PHOTO_MAX_BYTES, DOC_MAX_BYTES,
  buildPhotoPath, buildDocPath, isPhotoMime, formatBytes,
} from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { newUnitCode } from "@/lib/refcode";
import { formatEnumLabel, sqmToSqft } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OwnerPicker } from "@/components/owners/OwnerPicker";
import {
  OwnerDraft,
  fetchOwners,
  validateOwners,
  replaceOwners,
} from "@/lib/ownership";
import {
  BuildingType,
  UNIT_STATUS_OPTIONS,
  UnitStatusValue,
  UnitTypeValue,
  isResidentialType,
  isStatusLockedByLease,
  loadSizePref,
  saveSizePref,
  SizeUnit,
  toCanonicalSqm,
  unitTypesForBuilding,
} from "@/lib/units";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (createdUnit?: { id: string; status: UnitStatusValue }) => void;
  buildingId: string;
  parentBuildingType: BuildingType | string;
  initial?: any;
  /** Optional content rendered at the top of the form (e.g. building picker). */
  topSlot?: React.ReactNode;
  /** Override title/description (used when this dialog is reused for "global" new unit flow). */
  titleOverride?: string;
  descriptionOverride?: string;
  /**
   * Optional async hook called right before the unit is saved. Return a
   * resolved buildingId (and optionally a buildingType) to use for the insert.
   * Throw or return null/undefined to abort the save.
   */
  beforeSave?: () => Promise<{ buildingId: string; buildingType?: BuildingType | string } | null | undefined>;
}

interface FormState {
  unit_number: string;
  unit_type: UnitTypeValue | "";
  status: UnitStatusValue | "";
  floor: string;            // raw string for input
  size: string;
  size_unit: SizeUnit;
  bedrooms: string;
  bathrooms: string;
  description: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

const labelClass = "text-xs font-medium text-architect normal-case tracking-normal";
const errorClass = "text-xs text-destructive mt-1";

const emptyForm = (typeOptions: UnitTypeValue[]): FormState => ({
  unit_number: "",
  unit_type: typeOptions[0] ?? "apartment",
  status: "",
  floor: "",
  size: "",
  size_unit: loadSizePref(),
  bedrooms: "",
  bathrooms: "",
  description: "",
});

const fromInitial = (i: any, typeOptions: UnitTypeValue[]): FormState => {
  const pref: SizeUnit = i?.size_unit_preference === "sqft" ? "sqft" : "sqm";
  const sizeRaw =
    i?.size_sqm == null
      ? ""
      : pref === "sqft"
        ? String(sqmToSqft(Number(i.size_sqm)))
        : String(i.size_sqm);
  return {
    unit_number: i?.unit_number ?? "",
    unit_type: (i?.unit_type as UnitTypeValue) ?? typeOptions[0] ?? "apartment",
    status: (i?.status as UnitStatusValue) ?? "",
    floor: i?.floor != null ? String(i.floor) : "",
    size: sizeRaw,
    size_unit: pref,
    bedrooms: i?.bedrooms != null ? String(i.bedrooms) : "",
    bathrooms: i?.bathrooms != null ? String(i.bathrooms) : "",
    description: i?.description ?? "",
  };
};

export function UnitFormDialog({
  open,
  onOpenChange,
  onSaved,
  buildingId,
  parentBuildingType,
  initial,
  topSlot,
  titleOverride,
  descriptionOverride,
  beforeSave,
}: Props) {
  const typeOptions = useMemo(
    () => unitTypesForBuilding(parentBuildingType),
    [parentBuildingType],
  );

  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(typeOptions));
  const [baseline, setBaseline] = useState<FormState>(() => emptyForm(typeOptions));
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);

  // Ownership (only used on create)
  const [buildingOwners, setBuildingOwners] = useState<OwnerDraft[]>([]);
  const [ownerMode, setOwnerMode] = useState<"inherit" | "explicit">("inherit");
  const [ownerDraft, setOwnerDraft] = useState<OwnerDraft[]>([]);

  const unitNumberRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLButtonElement>(null);
  const sizeRef = useRef<HTMLInputElement>(null);

  const hideFloor = parentBuildingType === "villa_compound";
  const showResidential = isResidentialType(form.unit_type);
  const isStudio = form.unit_type === "studio";
  const statusLocked = initial ? isStatusLockedByLease(initial) : false;

  useEffect(() => {
    if (!open) return;
    const next = initial ? fromInitial(initial, typeOptions) : emptyForm(typeOptions);
    setForm(next);
    setBaseline(next);
    setErrors({});
  }, [open, initial, typeOptions]);

  // Load parent building owners on open (create mode only)
  useEffect(() => {
    if (!open || initial?.id) {
      setBuildingOwners([]);
      setOwnerMode("inherit");
      setOwnerDraft([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const own = await fetchOwners("building", buildingId);
        if (cancelled) return;
        setBuildingOwners(own);
        if (own.length > 0) {
          setOwnerMode("inherit");
          setOwnerDraft([]);
        } else {
          // JOP scenario — no building owners, must set unit owners
          setOwnerMode("explicit");
          setOwnerDraft([]);
        }
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load building owners.");
      }
    })();
    return () => { cancelled = true; };
  }, [open, initial?.id, buildingId]);

  // Force studio bedrooms = 0
  useEffect(() => {
    if (isStudio && form.bedrooms !== "0") {
      setForm((f) => ({ ...f, bedrooms: "0" }));
    }
  }, [isStudio]); // eslint-disable-line react-hooks/exhaustive-deps

  // When type flips to non-residential, drop bed/bath values so they don't persist
  useEffect(() => {
    if (!showResidential && (form.bedrooms !== "" || form.bathrooms !== "")) {
      setForm((f) => ({ ...f, bedrooms: "", bathrooms: "" }));
    }
  }, [showResidential]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = async (): Promise<Errors> => {
    const e: Errors = {};
    const num = form.unit_number.trim();
    if (!num) e.unit_number = "Unit number is required.";
    else if (num.length > 20) e.unit_number = "Max 20 characters.";

    if (!form.unit_type) e.unit_type = "Select a unit type.";
    if (!form.status) e.status = "Select a status.";

    if (form.size.trim() !== "") {
      const n = Number(form.size);
      if (!Number.isFinite(n) || n <= 0) e.size = "Size must be greater than 0.";
      else if (n > 100000) e.size = "Size is too large.";
    }

    if (!hideFloor && form.floor.trim() !== "") {
      const fl = form.floor.trim().toUpperCase();
      if (fl !== "G") {
        const n = Number(fl);
        if (!Number.isInteger(n) || n < 0 || n > 200) {
          e.floor = "Floor must be an integer 0–200 (or G for ground).";
        }
      }
    }

    if (showResidential && form.bedrooms.trim() !== "") {
      const n = Number(form.bedrooms);
      if (!Number.isInteger(n) || n < 0 || n > 20) e.bedrooms = "0–20 only.";
    }
    if (showResidential && form.bathrooms.trim() !== "") {
      const n = Number(form.bathrooms);
      if (!Number.isFinite(n) || n < 0 || n > 20) e.bathrooms = "0–20 only.";
    }

    if (form.description.length > 500) e.description = "Max 500 characters.";

    // Uniqueness — only run if no field-level errors so far
    if (!e.unit_number) {
      const q = supabase
        .from("units")
        .select("id")
        .eq("building_id", buildingId)
        .eq("unit_number", num)
        .limit(1);
      const { data, error } = initial?.id ? await q.neq("id", initial.id) : await q;
      if (error) {
        // surface as toast, not field error
        toast.error(error.message);
      } else if (data && data.length > 0) {
        e.unit_number = `Unit ${num} already exists in this building.`;
      }
    }

    return e;
  };

  const focusFirstError = (e: Errors) => {
    const order: (keyof FormState)[] = ["unit_number", "unit_type", "status", "size", "floor", "bedrooms", "bathrooms", "description"];
    const map: Partial<Record<keyof FormState, HTMLElement | null>> = {
      unit_number: unitNumberRef.current,
      unit_type: typeRef.current,
      status: statusRef.current,
      size: sizeRef.current,
    };
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
    setBusy(true);
    const v = await validate();
    if (Object.keys(v).length > 0) {
      setErrors(v);
      focusFirstError(v);
      setBusy(false);
      return;
    }

    // Validate ownership on create
    if (!initial?.id && ownerMode === "explicit") {
      const ov = validateOwners(ownerDraft);
      if (!ov.valid) {
        toast.error(ov.reason ?? "Owners are not valid.");
        setBusy(false);
        return;
      }
    }

    // Allow caller to resolve / create the parent building right before save.
    let effectiveBuildingId = buildingId;
    if (beforeSave) {
      try {
        const res = await beforeSave();
        if (!res || !res.buildingId) {
          setBusy(false);
          return;
        }
        effectiveBuildingId = res.buildingId;
      } catch (e: any) {
        toast.error(e?.message ?? "Could not prepare building.");
        setBusy(false);
        return;
      }
    }

    saveSizePref(form.size_unit);

    const sizeNum = form.size.trim() === "" ? null : toCanonicalSqm(Number(form.size), form.size_unit);
    const floorNum = (() => {
      if (hideFloor || form.floor.trim() === "") return null;
      const fl = form.floor.trim().toUpperCase();
      return fl === "G" ? 0 : Number(fl);
    })();

    const payload: any = {
      building_id: effectiveBuildingId,
      unit_number: form.unit_number.trim(),
      unit_type: form.unit_type,
      status: form.status,
      floor: floorNum,
      size_sqm: sizeNum,
      size_unit_preference: sizeNum == null ? null : form.size_unit,
      bedrooms: showResidential && form.bedrooms.trim() !== "" ? Number(form.bedrooms) : null,
      bathrooms: showResidential && form.bathrooms.trim() !== "" ? Number(form.bathrooms) : null,
      description: form.description.trim() || null,
    };

    let resultId: string | undefined = initial?.id;
    let error: any;
    const previousStatus: string | null = initial?.status ?? null;
    if (initial?.id) {
      ({ error } = await supabase.from("units").update(payload).eq("id", initial.id));
    } else {
      const { data: u } = await supabase.auth.getUser();
      payload.ref_code = newUnitCode();
      payload.created_by = u.user?.id;
      const { data, error: insErr } = await supabase.from("units").insert(payload).select("id").maybeSingle();
      error = insErr;
      resultId = data?.id;
    }
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    // Persist explicit unit ownership (create mode only)
    if (resultId && !initial?.id && ownerMode === "explicit" && ownerDraft.length > 0) {
      try {
        await replaceOwners("unit", resultId, ownerDraft);
      } catch (e: any) {
        toast.error(`Unit created, but ownership failed to save: ${e.message}`);
      }
    }

    // Log status change to richer history table
    if (resultId && (!initial?.id || previousStatus !== form.status)) {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("unit_status_history").insert({
        unit_id: resultId,
        old_status: previousStatus as any,
        new_status: form.status as any,
        changed_by: u.user?.id,
      });
    }

    // Bulk-attach any pending files (only on create, when files were chosen)
    if (resultId && !initial?.id && pendingFiles.length > 0) {
      toast.message(`Unit added. Uploading ${pendingFiles.length} file${pendingFiles.length === 1 ? "" : "s"}…`);
      const { data: u } = await supabase.auth.getUser();
      const uploaderId = u.user?.id;
      let uploaded = 0;
      let failed = 0;
      let assignCover = true; // first image becomes cover

      const results = await Promise.allSettled(
        pendingFiles.map(async (file) => {
          const isImg = isPhotoMime(file.type);
          const id = crypto.randomUUID();
          if (isImg) {
            const err = validateFile(file, PHOTO_MIMES, PHOTO_MAX_BYTES);
            if (err) throw new Error(err);
            const path = buildPhotoPath("unit", resultId!, id, file.name);
            const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
              contentType: file.type, upsert: false,
            });
            if (upErr) throw new Error(upErr.message);
            const cover = assignCover;
            assignCover = false;
            const { error: dbErr } = await supabase.from("photos").insert({
              id, entity_type: "unit", entity_id: resultId,
              storage_path: path, file_name: file.name,
              file_size_bytes: file.size, mime_type: file.type,
              is_cover: cover, sort_order: 0, uploaded_by: uploaderId,
            });
            if (dbErr) {
              await supabase.storage.from(PHOTO_BUCKET).remove([path]);
              throw new Error(dbErr.message);
            }
          } else {
            if (file.size > DOC_MAX_BYTES) {
              throw new Error(`${file.name}: exceeds 25 MB limit.`);
            }
            const path = buildDocPath("unit", resultId!, id, file.name);
            const { error: upErr } = await supabase.storage.from(DOC_BUCKET).upload(path, file, {
              contentType: file.type || "application/octet-stream", upsert: false,
            });
            if (upErr) throw new Error(upErr.message);
            const { error: dbErr } = await supabase.from("documents").insert({
              id, entity_type: "unit", entity_id: resultId,
              storage_path: path, file_name: file.name,
              file_size_bytes: file.size,
              mime_type: file.type || "application/octet-stream",
              doc_type: "other", uploaded_by: uploaderId,
            });
            if (dbErr) {
              await supabase.storage.from(DOC_BUCKET).remove([path]);
              throw new Error(dbErr.message);
            }
          }
        }),
      );
      results.forEach((r) => { r.status === "fulfilled" ? uploaded++ : failed++; });
      if (failed === 0) {
        toast.success(`${uploaded} file${uploaded === 1 ? "" : "s"} uploaded.`);
      } else {
        toast.warning(
          `Unit added, but ${failed} file${failed === 1 ? "" : "s"} failed to upload. Retry from the unit page.`,
        );
      }
    } else {
      toast.success(initial?.id ? "Unit updated" : "Unit added");
    }

    setPendingFiles([]);
    onSaved(resultId ? { id: resultId, status: form.status as UnitStatusValue } : undefined);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && isDirty && !busy) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(next);
  };

  const showOccupiedHelper = form.status === "occupied";

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {titleOverride ?? (initial?.id ? "Edit unit" : "New unit")}
            </DialogTitle>
            <DialogDescription>
              {descriptionOverride ?? (initial?.id ? "Update unit details." : "Add a unit to this building.")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4 pt-2" noValidate>
            {topSlot}
            {/* Row 1: Unit number + Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="u-num" className={labelClass}>
                  Unit number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="u-num"
                  ref={unitNumberRef}
                  value={form.unit_number}
                  onChange={(e) => set("unit_number", e.target.value.slice(0, 20))}
                  maxLength={20}
                  className={cn("mt-1.5", errors.unit_number && "border-destructive")}
                  aria-invalid={!!errors.unit_number}
                />
                {errors.unit_number && <p className={errorClass}>{errors.unit_number}</p>}
              </div>
              <div>
                <Label htmlFor="u-type" className={labelClass}>
                  Type <span className="text-destructive">*</span>
                </Label>
                <Select value={form.unit_type} onValueChange={(v) => set("unit_type", v as UnitTypeValue)}>
                  <SelectTrigger
                    id="u-type"
                    ref={typeRef}
                    className={cn("mt-1.5", errors.unit_type && "border-destructive")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((t) => (
                      <SelectItem key={t} value={t}>{formatEnumLabel(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.unit_type && <p className={errorClass}>{errors.unit_type}</p>}
              </div>
            </div>

            {/* Row 2: Status (+ Floor unless villa_compound) */}
            <div className={cn("grid gap-3", hideFloor ? "grid-cols-1" : "grid-cols-2")}>
              <div>
                <Label htmlFor="u-status" className={labelClass}>
                  Status <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => set("status", v as UnitStatusValue)}
                  disabled={statusLocked}
                >
                  <SelectTrigger
                    id="u-status"
                    ref={statusRef}
                    className={cn("mt-1.5", errors.status && "border-destructive")}
                  >
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{formatEnumLabel(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {statusLocked && (
                  <p className="text-xs text-muted-foreground mt-1">Status is set by the active lease.</p>
                )}
                {showOccupiedHelper && !errors.status && (
                  <p className="text-xs text-amber-700 mt-1">
                    You'll be prompted to add lease details after creating this unit.
                  </p>
                )}
                {errors.status && <p className={errorClass}>{errors.status}</p>}
              </div>

              {!hideFloor && (
                <div>
                  <Label htmlFor="u-floor" className={labelClass}>Floor</Label>
                  <Input
                    id="u-floor"
                    value={form.floor}
                    onChange={(e) => set("floor", e.target.value)}
                    placeholder="e.g. 16 or G"
                    className={cn("mt-1.5", errors.floor && "border-destructive")}
                    aria-invalid={!!errors.floor}
                  />
                  {errors.floor && <p className={errorClass}>{errors.floor}</p>}
                </div>
              )}
            </div>

            {/* Row 3: Size + unit toggle */}
            <div>
              <Label htmlFor="u-size" className={labelClass}>Size</Label>
              <div className="mt-1.5 flex items-stretch gap-2">
                <Input
                  id="u-size"
                  ref={sizeRef}
                  type="number"
                  step="0.01"
                  min={1}
                  value={form.size}
                  onChange={(e) => set("size", e.target.value)}
                  className={cn("flex-1", errors.size && "border-destructive")}
                  aria-invalid={!!errors.size}
                />
                <ToggleGroup
                  type="single"
                  value={form.size_unit}
                  onValueChange={(v) => v && set("size_unit", v as SizeUnit)}
                  className="border hairline rounded-sm bg-muted/40 p-0.5 gap-0 h-10"
                >
                  <ToggleGroupItem
                    value="sqm"
                    className="h-full px-3 text-[11px] uppercase tracking-wider data-[state=on]:bg-architect data-[state=on]:text-chalk rounded-sm"
                  >
                    sqm
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="sqft"
                    className="h-full px-3 text-[11px] uppercase tracking-wider data-[state=on]:bg-architect data-[state=on]:text-chalk rounded-sm"
                  >
                    sqft
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              {errors.size && <p className={errorClass}>{errors.size}</p>}
            </div>

            {/* Row 4: Bedrooms + Bathrooms (residential only) */}
            <div
              className={cn(
                "grid grid-cols-2 gap-3 overflow-hidden transition-all duration-200",
                showResidential ? "max-h-40 opacity-100" : "max-h-0 opacity-0 pointer-events-none",
              )}
              aria-hidden={!showResidential}
            >
              <div>
                <Label htmlFor="u-beds" className={labelClass}>Bedrooms</Label>
                <Input
                  id="u-beds"
                  type="number"
                  min={0}
                  max={20}
                  value={form.bedrooms}
                  onChange={(e) => set("bedrooms", e.target.value)}
                  disabled={isStudio}
                  className={cn("mt-1.5", errors.bedrooms && "border-destructive")}
                  aria-invalid={!!errors.bedrooms}
                />
                {isStudio && (
                  <p className="text-xs text-muted-foreground mt-1">Studios always have 0 bedrooms.</p>
                )}
                {errors.bedrooms && <p className={errorClass}>{errors.bedrooms}</p>}
              </div>
              <div>
                <Label htmlFor="u-baths" className={labelClass}>Bathrooms</Label>
                <Input
                  id="u-baths"
                  type="number"
                  step="0.5"
                  min={0}
                  max={20}
                  value={form.bathrooms}
                  onChange={(e) => set("bathrooms", e.target.value)}
                  className={cn("mt-1.5", errors.bathrooms && "border-destructive")}
                  aria-invalid={!!errors.bathrooms}
                />
                {errors.bathrooms && <p className={errorClass}>{errors.bathrooms}</p>}
              </div>
            </div>

            {/* Row 5: Description */}
            <div>
              <Label htmlFor="u-desc" className={labelClass}>Description</Label>
              <Textarea
                id="u-desc"
                rows={2}
                maxLength={500}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className={cn("mt-1.5", errors.description && "border-destructive")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Any notes about this unit — view, condition, layout quirks.
              </p>
              {errors.description && <p className={errorClass}>{errors.description}</p>}
            </div>

            {/* Ownership (only on create) */}
            {!initial?.id && (
              <div className="border hairline rounded-sm p-4 space-y-3 bg-muted/20">
                <div>
                  <div className="text-sm font-medium text-architect">
                    Ownership {buildingOwners.length === 0 && <span className="text-destructive">*</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {buildingOwners.length > 0
                      ? "This building has owners defined — units inherit by default."
                      : "This building has no owners (JOP). Assign at least one owner for this unit."}
                  </p>
                </div>

                {buildingOwners.length > 0 && (
                  <>
                    <div className="border hairline rounded-sm bg-card p-3 space-y-1">
                      <div className="label-eyebrow mb-1">Building owners</div>
                      {buildingOwners.map((o) => (
                        <div key={o.person_id} className="flex items-center justify-between text-xs">
                          <span className="text-architect truncate">
                            {o.person_name || "Unnamed"} {o.is_primary && <span className="text-gold-deep">★</span>}
                          </span>
                          <span className="mono text-muted-foreground">
                            {Number(o.ownership_percentage).toString().replace(/\.?0+$/, "")}%
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <label className="flex items-start gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="owner-mode"
                          checked={ownerMode === "inherit"}
                          onChange={() => { setOwnerMode("inherit"); setOwnerDraft([]); }}
                          className="mt-0.5"
                        />
                        <span className="text-architect">Inherit from building <span className="text-muted-foreground text-xs">(default)</span></span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="owner-mode"
                          checked={ownerMode === "explicit"}
                          onChange={() => {
                            setOwnerMode("explicit");
                            // Seed with copy of building owners
                            setOwnerDraft(
                              buildingOwners.map((o) => ({
                                person_id: o.person_id,
                                person_name: o.person_name,
                                person_company: o.person_company,
                                ownership_percentage: o.ownership_percentage,
                                is_primary: o.is_primary,
                              })),
                            );
                          }}
                          className="mt-0.5"
                        />
                        <span className="text-architect">Set different owner(s) for this unit</span>
                      </label>
                    </div>
                  </>
                )}

                {ownerMode === "explicit" && (
                  <div className="pt-1">
                    <OwnerPicker value={ownerDraft} onChange={setOwnerDraft} />
                  </div>
                )}
              </div>
            )}

            {/* Attach files (only on create) */}
            {!initial?.id && (
              <Collapsible open={attachOpen} onOpenChange={setAttachOpen} className="border hairline rounded-sm">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/30"
                  >
                    <span className="flex items-center gap-2 text-sm text-architect">
                      <Paperclip className="h-3.5 w-3.5 text-true-taupe" />
                      Attach files (optional)
                      {pendingFiles.length > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          · {pendingFiles.length} selected
                        </span>
                      )}
                    </span>
                    <ChevronDown className={cn("h-3.5 w-3.5 text-true-taupe transition-transform", attachOpen && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3 space-y-3">
                  <FileDropZone
                    accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
                    onFiles={(files) => setPendingFiles((prev) => [...prev, ...files])}
                    compact
                    helperText="Photos and documents will be attached to this unit. You can add more later."
                  />
                  {pendingFiles.length > 0 && (
                    <ul className="space-y-1.5">
                      {pendingFiles.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs px-2 py-1.5 bg-muted/30 rounded-sm">
                          {isPhotoMime(f.type)
                            ? <ImageIcon className="h-3.5 w-3.5 text-true-taupe shrink-0" />
                            : <FileText className="h-3.5 w-3.5 text-true-taupe shrink-0" />}
                          <span className="truncate flex-1 text-architect">{f.name}</span>
                          <span className="text-muted-foreground mono">{formatBytes(f.size)}</span>
                          <button
                            type="button"
                            onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                            className="h-5 w-5 flex items-center justify-center text-true-taupe hover:text-destructive"
                            aria-label={`Remove ${f.name}`}
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            <div className="flex justify-end gap-2 pt-4 mt-2">
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold" disabled={busy}>
                {busy ? "Saving…" : initial?.id ? "Save changes" : "Add unit"}
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
