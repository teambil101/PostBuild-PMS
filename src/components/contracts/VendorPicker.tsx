import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { vendorDisplayName } from "@/lib/vendors";
import { NewVendorDialog } from "@/components/vendors/NewVendorDialog";

export interface PickedVendor {
  id: string;
  vendor_number: string;
  legal_name: string;
  display_name: string | null;
  vendor_type: string;
  status: string;
  primary_email: string | null;
  primary_phone: string | null;
  default_call_out_fee: number | null;
  default_hourly_rate: number | null;
  currency: string;
}

interface Props {
  value: PickedVendor | null;
  onChange: (v: PickedVendor | null) => void;
  disabled?: boolean;
}

export function VendorPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState<PickedVendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vendors")
      .select("id, vendor_number, legal_name, display_name, vendor_type, status, primary_email, primary_phone, default_call_out_fee, default_hourly_rate, currency")
      .order("legal_name");
    setVendors((data ?? []) as PickedVendor[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedLabel = useMemo(() => (value ? vendorDisplayName(value) : ""), [value]);

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">
              {value ? selectedLabel : loading ? "Loading vendors…" : "Pick a vendor…"}
            </span>
            {value && (
              <span className="mono text-[10px] text-muted-foreground ml-1">{value.vendor_number}</span>
            )}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name or number…" />
          <CommandList>
            <CommandEmpty>No vendors found.</CommandEmpty>
            <CommandGroup>
              {vendors.map((v) => (
                <CommandItem
                  key={v.id}
                  value={`${vendorDisplayName(v)} ${v.vendor_number}`}
                  onSelect={() => {
                    onChange(v);
                    setOpen(false);
                  }}
                  disabled={v.status === "blacklisted"}
                >
                  <Check className={cn("h-3.5 w-3.5 mr-2", value?.id === v.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-architect truncate">
                      {vendorDisplayName(v)}
                      {v.status !== "active" && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                          ({v.status})
                        </span>
                      )}
                    </div>
                    <div className="mono text-[10px] text-muted-foreground">{v.vendor_number}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__add_new_vendor__"
                onSelect={() => {
                  setOpen(false);
                  setCreateOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-2 text-architect" />
                <span className="text-sm text-architect">New vendor…</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    <NewVendorDialog
      open={createOpen}
      onOpenChange={setCreateOpen}
      onSaved={async (vendorId) => {
        setCreateOpen(false);
        await load();
        const { data } = await supabase
          .from("vendors")
          .select("id, vendor_number, legal_name, display_name, vendor_type, status, primary_email, primary_phone, default_call_out_fee, default_hourly_rate, currency")
          .eq("id", vendorId)
          .maybeSingle();
        if (data) onChange(data as PickedVendor);
      }}
    />
    </>
  );
}