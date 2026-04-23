import { useEffect, useMemo, useState } from "react";
import { Search, Workflow } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_LABEL, type ServiceCategory } from "@/lib/services";
import { CategoryBadge, BillingBadge, DeliveryBadge } from "./CatalogBadges";
import { cn } from "@/lib/utils";
import type { CatalogEntry } from "./CatalogEntryDialog";

interface Props {
  selectedId: string | null;
  onSelect: (entry: CatalogEntry) => void;
}

export function CatalogPicker({ selectedId, onSelect }: Props) {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("service_catalog")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("name");
      setEntries(
        ((data ?? []) as any[]).map((d) => ({
          ...d,
          workflow_steps: Array.isArray(d.workflow_steps) ? d.workflow_steps : [],
        })) as CatalogEntry[],
      );
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q),
    );
  }, [entries, search]);

  const grouped = useMemo(() => {
    const map = new Map<ServiceCategory, CatalogEntry[]>();
    filtered.forEach((e) => {
      if (!map.has(e.category)) map.set(e.category, []);
      map.get(e.category)!.push(e);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search the catalog…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          autoFocus
        />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="border hairline rounded-sm bg-muted/30 px-4 py-6 text-sm text-muted-foreground text-center">
          Nothing matches. Try another keyword, or add it to the catalog first.
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto border hairline rounded-sm bg-card divide-y hairline">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <div className="px-3 py-1.5 bg-muted/40 label-eyebrow text-muted-foreground border-b hairline">
                {CATEGORY_LABEL[category]}
              </div>
              {items.map((entry) => {
                const active = entry.id === selectedId;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onSelect(entry)}
                    className={cn(
                      "w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors",
                      active ? "bg-architect/5" : "hover:bg-muted/30",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-sm", active ? "text-architect font-medium" : "text-architect")}>
                          {entry.name}
                        </span>
                        {entry.is_workflow && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-architect border border-architect/40 px-1.5 py-0.5 rounded-sm">
                            <Workflow className="h-3 w-3" />
                            {entry.workflow_steps.length} steps
                          </span>
                        )}
                      </div>
                      {entry.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{entry.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <DeliveryBadge value={entry.default_delivery} />
                      <BillingBadge value={entry.default_billing} />
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}