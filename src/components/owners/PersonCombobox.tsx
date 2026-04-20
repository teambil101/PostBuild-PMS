import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { PersonQuickAddDialog } from "@/components/people/PersonQuickAddDialog";

export interface PickedPerson {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
}

interface Props {
  value: string;                 // person_id
  valueLabel?: string;           // display name for the selected person
  onChange: (person: PickedPerson) => void;
  placeholder?: string;
  invalid?: boolean;
  excludeIds?: string[];         // persons already picked in other rows
  /** Restrict results to people whose `roles` array contains any of these. */
  roleFilter?: ("tenant" | "owner" | "prospect" | "staff" | "vendor")[];
  /** Hide the inline "Add new person" action (e.g. for assignee pickers). */
  hideAddNew?: boolean;
}

/**
 * Searchable people combobox with inline "+ Add new person" subdialog.
 * Searches first_name, last_name, company, ref_code.
 */
export function PersonCombobox({
  value,
  valueLabel,
  onChange,
  placeholder = "Search people…",
  invalid,
  excludeIds = [],
  roleFilter,
  hideAddNew = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      const q = query.trim();
      let req = supabase
        .from("people")
        .select("id, first_name, last_name, company")
        .order("first_name")
        .limit(20);
      if (roleFilter && roleFilter.length > 0) {
        // people.roles is a person_role[] — overlaps operator returns rows
        // whose array shares at least one value with the filter.
        req = req.overlaps("roles", roleFilter);
      }
      if (q) {
        // Search across name, company, ref_code
        const like = `%${q}%`;
        req = req.or(
          `first_name.ilike.${like},last_name.ilike.${like},company.ilike.${like},ref_code.ilike.${like}`,
        );
      }
      const { data } = await req;
      setResults((data ?? []) as PickedPerson[]);
      setLoading(false);
    }, 180);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [open, query, roleFilter]);

  const display = useMemo(() => valueLabel || (value ? "Selected person" : ""), [valueLabel, value]);
  const visibleResults = results.filter((r) => !excludeIds.includes(r.id) || r.id === value);

  const handleSelect = (p: PickedPerson) => {
    onChange(p);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm",
              "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              invalid ? "border-destructive" : "border-input",
            )}
          >
            <span className={cn("truncate", !display && "text-muted-foreground")}>
              {display || placeholder}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={placeholder}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                <div className="px-2 py-3 text-sm text-muted-foreground">
                  {loading ? "Searching…" : "No people match."}
                </div>
              </CommandEmpty>
              {visibleResults.length > 0 && (
                <CommandGroup heading="People">
                  {visibleResults.map((p) => {
                    const name = `${p.first_name} ${p.last_name}`.trim();
                    return (
                      <CommandItem
                        key={p.id}
                        value={`${name} ${p.company ?? ""} ${p.id}`}
                        onSelect={() => handleSelect(p)}
                      >
                        <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-architect truncate">{name}</div>
                          {p.company && <div className="text-[11px] text-muted-foreground truncate">{p.company}</div>}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {!hideAddNew && (
                <CommandGroup>
                  <CommandItem
                    value="__add_new__"
                    onSelect={() => {
                      setOpen(false);
                      setQuickAddOpen(true);
                    }}
                    className="text-architect"
                  >
                    <UserPlus className="mr-2 h-4 w-4 text-gold" />
                    <span>Add new person{query.trim() && <span className="text-muted-foreground"> — “{query.trim()}”</span>}</span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <PersonQuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        initialFullName={query}
        onCreated={(p) => {
          handleSelect(p as PickedPerson);
        }}
      />
    </>
  );
}