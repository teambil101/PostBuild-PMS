import { useEffect, useMemo, useState } from "react";
import { Search, Workflow } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_LABEL, type ServiceCategory } from "@/lib/services";
import { cn } from "@/lib/utils";

interface CatalogItem {
  id: string;
  code: string;
  name: string;
  category: ServiceCategory;
  is_workflow: boolean;
  description: string | null;
}

interface Props {
  value: string[]; // array of catalog codes
  onChange: (codes: string[]) => void;
}

export function CoveredServicesPicker({ value, onChange }: Props) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("service_catalog")
        .select("id, code, name, category, is_workflow, description")
        .eq("is_active", true)
        .order("category")
        .order("name");
      setItems((data ?? []) as CatalogItem[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const grouped = useMemo(() => {
    const map = new Map<ServiceCategory, CatalogItem[]>();
    filtered.forEach((i) => {
      if (!map.has(i.category)) map.set(i.category, []);
      map.get(i.category)!.push(i);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const toggle = (code: string) => {
    if (value.includes(code)) {
      onChange(value.filter((c) => c !== code));
    } else {
      onChange([...value, code]);
    }
  };

  const selectAll = () => onChange(items.map((i) => i.code));
  const clearAll = () => onChange([]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center gap-2 justify-between">
        <div className="relative md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter services…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-muted-foreground">
            {value.length === 0 ? "Empty = covers all" : `${value.length} selected`}
          </span>
          <button type="button" onClick={selectAll} className="text-architect hover:text-gold uppercase tracking-wider">
            Select all
          </button>
          <button type="button" onClick={clearAll} className="text-muted-foreground hover:text-architect uppercase tracking-wider">
            Clear
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading catalog…</div>
      ) : (
        <div className="max-h-[380px] overflow-y-auto border hairline rounded-sm bg-card">
          {grouped.map(([category, group]) => (
            <div key={category}>
              <div className="px-3 py-1.5 bg-muted/40 label-eyebrow text-muted-foreground border-b hairline sticky top-0">
                {CATEGORY_LABEL[category]}
              </div>
              <div className="divide-y hairline">
                {group.map((item) => {
                  const checked = value.includes(item.code);
                  return (
                    <label
                      key={item.id}
                      className={cn(
                        "px-3 py-2 flex items-start gap-3 cursor-pointer transition-colors",
                        checked ? "bg-architect/5" : "hover:bg-muted/30",
                      )}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggle(item.code)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-architect">{item.name}</span>
                          {item.is_workflow && (
                            <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-architect border border-architect/40 px-1.5 py-0.5 rounded-sm">
                              <Workflow className="h-2.5 w-2.5" />
                              Workflow
                            </span>
                          )}
                          <span className="mono text-[10px] text-muted-foreground">{item.code}</span>
                        </div>
                        {item.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}