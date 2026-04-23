import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_LABEL, type ServiceCategory } from "@/lib/services";
import { cn } from "@/lib/utils";

export interface CatalogPickerEntry {
  id: string;
  code: string;
  name: string;
  category: ServiceCategory;
  category_other: string | null;
  default_delivery: string;
  default_billing: string;
  typical_duration_days: number | null;
  is_workflow: boolean;
}

interface Props {
  value: string | null;
  onChange: (entry: CatalogPickerEntry) => void;
  /** Catalog entry IDs to exclude (e.g. self-reference). */
  excludeIds?: string[];
  placeholder?: string;
}

/**
 * Compact popover combobox for picking a catalog service to chain inside a workflow.
 * Filters out workflow-type catalog entries to prevent nested workflows.
 */
export function CatalogServicePicker({ value, onChange, excludeIds = [], placeholder = "Pick a catalog service…" }: Props) {
  const [entries, setEntries] = useState<CatalogPickerEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("service_catalog")
        .select("id, code, name, category, category_other, default_delivery, default_billing, typical_duration_days, is_workflow")
        .eq("is_active", true)
        .eq("is_workflow", false) // no nested workflows in v1
        .order("category")
        .order("name");
      setEntries((data ?? []) as CatalogPickerEntry[]);
      setLoading(false);
    })();
  }, []);

  const visible = useMemo(
    () => entries.filter((e) => !excludeIds.includes(e.id)),
    [entries, excludeIds],
  );

  const selected = useMemo(() => visible.find((e) => e.id === value) ?? null, [visible, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-8 text-xs font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="truncate">
            {selected ? selected.name : value ? "Service no longer available" : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search catalog…" className="h-9" />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading…" : "No matching catalog service. Add it to the catalog first."}
            </CommandEmpty>
            <CommandGroup>
              {visible.map((entry) => {
                const active = entry.id === value;
                return (
                  <CommandItem
                    key={entry.id}
                    value={`${entry.name} ${entry.code}`}
                    onSelect={() => {
                      onChange(entry);
                      setOpen(false);
                    }}
                    className="flex items-start gap-2 py-2"
                  >
                    <Check className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", active ? "opacity-100" : "opacity-0")} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-architect truncate">{entry.name}</div>
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                        <span>
                          {entry.category === "other" && entry.category_other
                            ? entry.category_other
                            : CATEGORY_LABEL[entry.category]}
                        </span>
                        <span>·</span>
                        <span className="mono">{entry.code}</span>
                        {entry.typical_duration_days != null && (
                          <>
                            <span>·</span>
                            <span>~{entry.typical_duration_days}d</span>
                          </>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <div className="px-3 py-2 text-[10px] text-muted-foreground border-t hairline flex items-center gap-1.5">
              <Workflow className="h-3 w-3" />
              Workflow services can't be nested in v1.
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}