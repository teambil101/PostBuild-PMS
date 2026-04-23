import { useEffect, useMemo, useState } from "react";
import { Plus, Wrench, Search, Pencil, Workflow, Power, PowerOff, Filter } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  CADENCE_LABEL,
  CATEGORY_LABEL,
  type ServiceCategory,
} from "@/lib/services";
import { BillingBadge, CategoryBadge, DeliveryBadge } from "@/components/services/CatalogBadges";
import { CatalogEntryDialog, type CatalogEntry } from "@/components/services/CatalogEntryDialog";
import { cn } from "@/lib/utils";

type CatalogFilter = "all" | "active" | "inactive" | "workflow" | "atomic";

const FILTERS: { key: CatalogFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
  { key: "workflow", label: "Workflows" },
  { key: "atomic", label: "Atomic" },
];

export default function Services() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogEntry | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("service_catalog")
      .select("*")
      .order("category")
      .order("name");
    if (!error && data) {
      setEntries(
        (data as any[]).map((d) => ({
          ...d,
          workflow_steps: Array.isArray(d.workflow_steps) ? d.workflow_steps : [],
        })) as CatalogEntry[],
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === "active" && !e.is_active) return false;
      if (filter === "inactive" && e.is_active) return false;
      if (filter === "workflow" && !e.is_workflow) return false;
      if (filter === "atomic" && e.is_workflow) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [entries, filter, search]);

  // Group by category for visual grouping
  const grouped = useMemo(() => {
    const map = new Map<ServiceCategory, CatalogEntry[]>();
    filtered.forEach((e) => {
      if (!map.has(e.category)) map.set(e.category, []);
      map.get(e.category)!.push(e);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const toggleActive = async (entry: CatalogEntry) => {
    const { error } = await supabase
      .from("service_catalog")
      .update({ is_active: !entry.is_active })
      .eq("id", entry.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(entry.is_active ? "Hidden from menu" : "Active in menu");
    void load();
  };

  const startEdit = (entry: CatalogEntry) => {
    setEditing(entry);
    setDialogOpen(true);
  };

  const startCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        eyebrow="Module"
        title="Services"
        description="The catalog of services your team offers — atomic jobs and multi-step workflows. Drives every service request."
        actions={
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" />
            New service
          </Button>
        }
      />

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog ({entries.length})</TabsTrigger>
          <TabsTrigger value="requests" disabled>
            Requests <span className="ml-1.5 text-[9px] uppercase tracking-wider opacity-60">Soon</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-sm border hairline transition-colors",
                    filter === f.key
                      ? "bg-architect text-chalk border-architect"
                      : "text-muted-foreground hover:text-architect hover:bg-muted/40",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search catalog…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground py-12 text-center">Loading catalog…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Wrench className="h-10 w-10" strokeWidth={1.2} />}
              title={entries.length === 0 ? "Catalog is empty" : "Nothing matches"}
              description={
                entries.length === 0
                  ? "Add your first service to define what your team offers."
                  : "Try a different filter or clear the search."
              }
              action={
                entries.length === 0 ? (
                  <Button onClick={startCreate}>
                    <Plus className="h-4 w-4" />
                    New service
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-6">
              {grouped.map(([category, items]) => (
                <section key={category}>
                  <h3 className="label-eyebrow text-muted-foreground mb-2 px-1">
                    {CATEGORY_LABEL[category]}
                    <span className="text-muted-foreground/60 ml-2 normal-case tracking-normal">{items.length}</span>
                  </h3>
                  <div className="border hairline rounded-sm bg-card divide-y hairline overflow-hidden">
                    {items.map((entry) => (
                      <div
                        key={entry.id}
                        className={cn(
                          "px-4 py-3 flex items-center gap-4 hover:bg-muted/30 transition-colors",
                          !entry.is_active && "opacity-60",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => startEdit(entry)}
                              className="text-sm text-architect hover:text-gold font-medium text-left"
                            >
                              {entry.name}
                            </button>
                            {entry.is_workflow && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-architect border border-architect/40 px-1.5 py-0.5 rounded-sm">
                                <Workflow className="h-3 w-3" />
                                {entry.workflow_steps.length} steps
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="mono text-[10px] text-muted-foreground">{entry.code}</span>
                            <CategoryBadge value={entry.category} />
                            {entry.cadence !== "one_off" && (
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                · {CADENCE_LABEL[entry.cadence]}
                              </span>
                            )}
                            {entry.typical_duration_days && (
                              <span className="text-[10px] text-muted-foreground">
                                · ~{entry.typical_duration_days}d
                              </span>
                            )}
                          </div>
                          {entry.description && (
                            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{entry.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <DeliveryBadge value={entry.default_delivery} />
                          <BillingBadge value={entry.default_billing} />
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleActive(entry)}
                            aria-label={entry.is_active ? "Deactivate" : "Activate"}
                            title={entry.is_active ? "Deactivate" : "Activate"}
                          >
                            {entry.is_active ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(entry)}
                            aria-label="Edit"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" />
      </Tabs>

      <CatalogEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editing}
        onSaved={() => void load()}
      />
    </>
  );
}
