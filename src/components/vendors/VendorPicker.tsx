import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Star, X, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import {
  parseSpecialties,
  vendorDisplayName,
  SPECIALTY_LABELS,
  complianceState,
  type Specialty,
} from "@/lib/vendors";

export interface PickedVendor {
  id: string;
  legal_name: string;
  display_name: string | null;
  vendor_number: string;
  is_preferred: boolean;
  specialties: unknown;
  trade_license_expiry_date: string | null;
  insurance_expiry_date: string | null;
  status: string;
}

interface Props {
  /** Selected vendor id, or null/empty for none. */
  value: string | null;
  /** Display label for selected vendor (used when only id is known). */
  valueLabel?: string;
  onChange: (vendor: PickedVendor | null) => void;
  /** Smart filter — restricts to vendors whose specialties array includes this. */
  filterSpecialty?: Specialty | null;
  /** When true, also include 'inactive' vendors. Blacklisted are always excluded. */
  includeInactive?: boolean;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** When true, the trigger renders a "Remove vendor" item at the top of the list. */
  allowClear?: boolean;
}

/**
 * Searchable vendor combobox with smart specialty filter and preferred-first ordering.
 * Excludes blacklisted vendors. The currently-selected vendor is always shown
 * even if filtered out.
 */
export function VendorPicker({
  value,
  valueLabel,
  onChange,
  filterSpecialty = null,
  includeInactive = false,
  placeholder = "Search vendors…",
  invalid,
  disabled,
  allowClear = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedVendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAllSpecialties, setShowAllSpecialties] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // Reset specialty filter toggle when filterSpecialty changes.
  useEffect(() => {
    setShowAllSpecialties(false);
  }, [filterSpecialty]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      const q = query.trim();
      let req = supabase
        .from("vendors")
        .select(
          "id, legal_name, display_name, vendor_number, is_preferred, specialties, trade_license_expiry_date, insurance_expiry_date, status",
        )
        .neq("status", "blacklisted")
        .order("is_preferred", { ascending: false })
        .order("legal_name")
        .limit(50);

      if (!includeInactive) {
        req = req.eq("status", "active");
      }
      if (q) {
        const like = `%${q}%`;
        req = req.or(
          `legal_name.ilike.${like},display_name.ilike.${like},vendor_number.ilike.${like}`,
        );
      }
      const { data } = await req;
      setResults((data ?? []) as PickedVendor[]);
      setLoading(false);
    }, 180);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [open, query, includeInactive]);

  // Apply smart specialty filter client-side (jsonb queries are awkward and
  // we want to allow toggling without re-fetching).
  const filtered = useMemo(() => {
    if (!filterSpecialty || showAllSpecialties) return results;
    return results.filter((v) => {
      // Always keep the currently selected vendor visible.
      if (v.id === value) return true;
      const specs = parseSpecialties(v.specialties);
      return specs.includes(filterSpecialty);
    });
  }, [results, filterSpecialty, showAllSpecialties, value]);

  // Group: preferred first, then others.
  const preferred = filtered.filter((v) => v.is_preferred);
  const others = filtered.filter((v) => !v.is_preferred);

  const selected = useMemo(() => {
    if (!value) return null;
    return results.find((v) => v.id === value) ?? null;
  }, [results, value]);

  const display = useMemo(() => {
    if (selected) return vendorDisplayName(selected);
    return valueLabel || "";
  }, [selected, valueLabel]);

  const handleSelect = (v: PickedVendor) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm",
            "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            invalid ? "border-destructive" : "border-input",
            disabled && "opacity-60 cursor-not-allowed",
          )}
        >
          <span className={cn("truncate flex items-center gap-1.5", !display && "text-muted-foreground")}>
            {selected?.is_preferred && <Star className="h-3 w-3 fill-gold text-gold shrink-0" />}
            {display || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[320px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          {filterSpecialty && (
            <div className="flex items-center justify-between border-b hairline px-3 py-2 bg-muted/30 text-[11px]">
              <span className="text-muted-foreground">
                Filtered to <span className="text-architect">{SPECIALTY_LABELS[filterSpecialty]}</span> specialists
              </span>
              <button
                type="button"
                onClick={() => setShowAllSpecialties((s) => !s)}
                className="text-architect underline decoration-gold/60 underline-offset-2 hover:decoration-gold"
              >
                {showAllSpecialties ? "Re-apply filter" : "Show all specialties"}
              </button>
            </div>
          )}
          <CommandList className="max-h-[320px]">
            <CommandEmpty>
              <div className="px-2 py-3 text-sm text-muted-foreground">
                {loading ? "Searching…" : "No vendors match."}
              </div>
            </CommandEmpty>

            {allowClear && value && (
              <>
                <CommandGroup>
                  <CommandItem
                    value="__remove__"
                    onSelect={() => {
                      onChange(null);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="text-destructive"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Remove vendor assignment
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {preferred.length > 0 && (
              <CommandGroup heading="Preferred">
                {preferred.map((v) => (
                  <VendorRow key={v.id} v={v} value={value} onSelect={handleSelect} />
                ))}
              </CommandGroup>
            )}
            {others.length > 0 && (
              <CommandGroup heading={preferred.length > 0 ? "Other vendors" : "Vendors"}>
                {others.map((v) => (
                  <VendorRow key={v.id} v={v} value={value} onSelect={handleSelect} />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function VendorRow({
  v,
  value,
  onSelect,
}: {
  v: PickedVendor;
  value: string | null;
  onSelect: (v: PickedVendor) => void;
}) {
  const tlState = complianceState(v.trade_license_expiry_date);
  const insState = complianceState(v.insurance_expiry_date);
  const expired = tlState === "expired" || insState === "expired";
  const name = vendorDisplayName(v);
  const specs = parseSpecialties(v.specialties);
  return (
    <CommandItem
      value={`${name} ${v.vendor_number} ${v.id}`}
      onSelect={() => onSelect(v)}
    >
      <Check className={cn("mr-2 h-4 w-4 shrink-0", value === v.id ? "opacity-100" : "opacity-0")} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {v.is_preferred && <Star className="h-3 w-3 fill-gold text-gold shrink-0" />}
          <span className="text-sm text-architect truncate">{name}</span>
          {expired && (
            <span title="Compliance expired" className="text-destructive shrink-0">
              <ShieldAlert className="h-3 w-3" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
          <span className="mono">{v.vendor_number}</span>
          {specs.length > 0 && (
            <span className="truncate">
              · {specs.slice(0, 3).map((s) => SPECIALTY_LABELS[s]).join(", ")}
              {specs.length > 3 && ` +${specs.length - 3}`}
            </span>
          )}
        </div>
      </div>
    </CommandItem>
  );
}
