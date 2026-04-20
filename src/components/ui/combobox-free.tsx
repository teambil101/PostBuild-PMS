import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface ComboboxFreeProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  emptyHint?: string;
  invalid?: boolean;
  id?: string;
}

/**
 * Searchable dropdown with free-text fallback.
 * - Type to filter the seed list.
 * - If no match, the typed text becomes the value on Enter or by clicking the "Use …" hint.
 */
export function ComboboxFree({
  value,
  onChange,
  options,
  placeholder = "Search or type…",
  emptyHint = "Press Enter to use as-is",
  invalid,
  id,
}: ComboboxFreeProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (open) setQuery(value ?? "");
  }, [open, value]);

  const commit = (v: string) => {
    onChange(v.trim());
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm",
            "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            invalid ? "border-destructive" : "border-input",
          )}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (query.trim()) commit(query);
              }
            }}
          />
          <CommandList>
            <CommandEmpty>
              <div className="px-2 py-1.5 text-sm">
                {query.trim() ? (
                  <button
                    type="button"
                    onClick={() => commit(query)}
                    className="text-left w-full hover:text-architect"
                  >
                    Use “<span className="font-medium text-architect">{query.trim()}</span>” — {emptyHint}
                  </button>
                ) : (
                  <span className="text-muted-foreground">No matches</span>
                )}
              </div>
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => commit(opt)}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")}
                  />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}