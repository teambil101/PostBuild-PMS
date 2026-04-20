import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  TICKET_TARGET_TYPES,
  TICKET_TARGET_TYPE_LABELS,
  type TicketTargetType,
} from "@/lib/tickets";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface TargetOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface Props {
  value: { type: TicketTargetType; id: string | null };
  onChange: (next: { type: TicketTargetType; id: string | null; label?: string }) => void;
  disabled?: boolean;
  /** When true, the type cannot be changed (e.g. opened from an entity page). */
  lockType?: boolean;
  /** Optional whitelist of valid target types (for ticket_type-based filtering). */
  allowedTypes?: TicketTargetType[];
}

export function TicketTargetPicker({ value, onChange, disabled, lockType, allowedTypes }: Props) {
  const types = allowedTypes && allowedTypes.length > 0 ? allowedTypes : TICKET_TARGET_TYPES;
  return (
    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2">
      <Select
        value={value.type}
        onValueChange={(v) =>
          onChange({ type: v as TicketTargetType, id: null, label: undefined })
        }
        disabled={disabled || lockType}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {types.map((t) => (
            <SelectItem key={t} value={t}>
              {TICKET_TARGET_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <TargetCombobox
        type={value.type}
        valueId={value.id}
        onPick={(opt) =>
          onChange({ type: value.type, id: opt.id, label: opt.label })
        }
        disabled={disabled}
      />
    </div>
  );
}

function TargetCombobox({
  type,
  valueId,
  onPick,
  disabled,
}: {
  type: TicketTargetType;
  valueId: string | null;
  onPick: (opt: TargetOption) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<TargetOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);

  useEffect(() => {
    setSearch("");
    setPickedLabel(null);
    setResults([]);
  }, [type]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const opts = await searchTargets(type, debounced);
      if (!cancelled) {
        setResults(opts);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, debounced, open]);

  const display = useMemo(() => {
    if (pickedLabel) return pickedLabel;
    if (!valueId) return `Search ${TICKET_TARGET_TYPE_LABELS[type].toLowerCase()}…`;
    return `${TICKET_TARGET_TYPE_LABELS[type]} · ${valueId.slice(0, 8)}`;
  }, [pickedLabel, valueId, type]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            "w-full justify-between text-left font-normal",
            !valueId && "text-muted-foreground",
          )}
        >
          <span className="truncate">{display}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 pointer-events-auto"
        align="start"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <div className="p-2 border-b hairline">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${TICKET_TARGET_TYPE_LABELS[type].toLowerCase()}…`}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No results.
            </div>
          ) : (
            <ul>
              {results.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(opt);
                      setPickedLabel(opt.label);
                      setOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-start gap-2 text-sm"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 mt-0.5 shrink-0",
                        valueId === opt.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-architect truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="block text-[11px] text-muted-foreground truncate">
                          {opt.sublabel}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* =========================================================
 * Search by target type
 * ========================================================= */
async function searchTargets(
  type: TicketTargetType,
  q: string,
): Promise<TargetOption[]> {
  const term = q.trim();
  switch (type) {
    case "unit": {
      let qb = supabase
        .from("units")
        .select("id, unit_number, building_id, buildings:buildings(name)")
        .order("unit_number", { ascending: true })
        .limit(20);
      if (term) qb = qb.ilike("unit_number", `%${term}%`);
      const { data } = await qb;
      return (data ?? []).map((u: any) => ({
        id: u.id,
        label: `Unit ${u.unit_number} · ${u.buildings?.name ?? "—"}`,
      }));
    }
    case "building": {
      let qb = supabase.from("buildings").select("id, name, city").order("name").limit(20);
      if (term) qb = qb.ilike("name", `%${term}%`);
      const { data } = await qb;
      return (data ?? []).map((b: any) => ({
        id: b.id,
        label: b.name,
        sublabel: b.city ?? undefined,
      }));
    }
    case "contract": {
      let qb = supabase
        .from("contracts")
        .select("id, contract_number, contract_type, title")
        .order("created_at", { ascending: false })
        .limit(20);
      if (term) {
        qb = qb.or(
          `contract_number.ilike.%${term}%,title.ilike.%${term}%`,
        );
      }
      const { data } = await qb;
      return (data ?? []).map((c: any) => ({
        id: c.id,
        label: `${c.contract_number} · ${c.title}`,
        sublabel: c.contract_type,
      }));
    }
    case "person": {
      let qb = supabase
        .from("people")
        .select("id, first_name, last_name, company, primary_email, phone")
        .order("first_name")
        .limit(20);
      if (term) {
        qb = qb.or(
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%,company.ilike.%${term}%,phone.ilike.%${term}%`,
        );
      }
      const { data } = await qb;
      return (data ?? []).map((p: any) => ({
        id: p.id,
        label: `${p.first_name} ${p.last_name}`.trim(),
        sublabel: p.company ?? p.primary_email ?? p.phone ?? undefined,
      }));
    }
    case "cheque": {
      let qb = supabase
        .from("lease_cheques")
        .select(
          "id, sequence_number, amount, due_date, lease_id, leases:leases(contract_id, contracts:contracts(contract_number))",
        )
        .order("due_date", { ascending: false })
        .limit(20);
      if (term) qb = qb.ilike("cheque_number", `%${term}%`);
      const { data } = await qb;
      return (data ?? []).map((c: any) => {
        const num = c.leases?.contracts?.contract_number ?? "—";
        return {
          id: c.id,
          label: `Cheque #${c.sequence_number} · ${num}`,
          sublabel: `AED ${Number(c.amount).toLocaleString()} due ${new Date(c.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
        };
      });
    }
    case "vendor": {
      let qb = supabase
        .from("vendors")
        .select("id, legal_name, display_name, vendor_number")
        .order("legal_name")
        .limit(20);
      if (term) {
        qb = qb.or(
          `legal_name.ilike.%${term}%,display_name.ilike.%${term}%,vendor_number.ilike.%${term}%`,
        );
      }
      const { data } = await qb;
      return (data ?? []).map((v: any) => ({
        id: v.id,
        label: `${v.display_name || v.legal_name} · ${v.vendor_number}`,
      }));
    }
    case "lead": {
      let qb = supabase
        .from("leads")
        .select(
          "id, lead_number, status, primary_contact_id, people:primary_contact_id(first_name, last_name, company)",
        )
        .order("created_at", { ascending: false })
        .limit(20);
      if (term) qb = qb.ilike("lead_number", `%${term}%`);
      const { data } = await qb;
      return (data ?? []).map((l: any) => {
        const p = l.people;
        const name = p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : "(no contact)";
        return {
          id: l.id,
          label: `${name} · ${l.lead_number}`,
          sublabel: p?.company ?? l.status,
        };
      });
    }
  }
}