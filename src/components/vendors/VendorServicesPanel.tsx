import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, MapPin, Clock, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  QUALITY_LABEL,
  QUALITY_STYLES,
  type VendorServiceQuality,
} from "@/lib/vendor-services";
import { cn } from "@/lib/utils";

interface CatalogRow {
  id: string;
  name: string;
  code: string;
  category: string;
}

interface VendorServiceRow {
  id: string;
  vendor_id: string;
  catalog_id: string;
  list_price: number | null;
  currency: string;
  quality_tier: VendorServiceQuality;
  lead_time_days: number | null;
  min_order_amount: number | null;
  service_area_cities: string[];
  service_area_communities: string[];
  service_area_all_cities: boolean;
  is_active: boolean;
  notes: string | null;
}

interface Props {
  vendorId: string;
  workspaceId: string | null;
  canEdit: boolean;
}

export function VendorServicesPanel({ vendorId, workspaceId, canEdit }: Props) {
  const [rows, setRows] = useState<VendorServiceRow[]>([]);
  const [catalog, setCatalog] = useState<Record<string, CatalogRow>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<VendorServiceRow | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: vsData } = await supabase
      .from("vendor_services")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });
    const list = (vsData ?? []) as VendorServiceRow[];
    setRows(list);
    if (list.length) {
      const ids = Array.from(new Set(list.map((r) => r.catalog_id)));
      const { data: cData } = await supabase
        .from("service_catalog")
        .select("id, name, code, category")
        .in("id", ids);
      const map: Record<string, CatalogRow> = {};
      (cData ?? []).forEach((c: any) => (map[c.id] = c));
      setCatalog(map);
    } else {
      setCatalog({});
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [vendorId]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("vendor_services").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Service removed");
    await load();
  };

  return (
    <Card className="hairline">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Services this vendor covers
              {rows.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  · {rows.length}
                </span>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Determines which work orders this vendor is invited to quote on, and at what list
              price / quality tier / service area.
            </p>
          </div>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add service
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-xs text-muted-foreground italic py-2">
            No services declared yet. Add at least one so this vendor receives quote invitations.
          </div>
        ) : (
          rows.map((r) => {
            const c = catalog[r.catalog_id];
            return (
              <div
                key={r.id}
                className={cn(
                  "border hairline rounded-sm p-3 bg-card",
                  !r.is_active && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-architect">
                        {c?.name ?? "Unknown service"}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] uppercase tracking-wider",
                          QUALITY_STYLES[r.quality_tier],
                        )}
                      >
                        {QUALITY_LABEL[r.quality_tier]}
                      </Badge>
                      {!r.is_active && (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                          Paused
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span className="mono tabular-nums">
                        {r.list_price != null
                          ? `${r.currency} ${Number(r.list_price).toLocaleString()}`
                          : "Price on request"}
                      </span>
                      {r.lead_time_days != null && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {r.lead_time_days} day{r.lead_time_days === 1 ? "" : "s"}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {r.service_area_all_cities
                          ? "All cities"
                          : r.service_area_cities.length
                            ? r.service_area_cities.join(", ")
                            : "No areas set"}
                      </span>
                    </div>
                    {r.notes && (
                      <div className="text-xs text-muted-foreground mt-1 italic">{r.notes}</div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      <VendorServiceDialog
        open={creating || editing != null}
        onOpenChange={(v) => {
          if (!v) {
            setEditing(null);
            setCreating(false);
          }
        }}
        vendorId={vendorId}
        workspaceId={workspaceId}
        existing={editing}
        existingCatalogIds={rows.map((r) => r.catalog_id)}
        onSaved={load}
      />
    </Card>
  );
}

/* ----------------------- dialog ----------------------- */

function VendorServiceDialog({
  open,
  onOpenChange,
  vendorId,
  workspaceId,
  existing,
  existingCatalogIds,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vendorId: string;
  workspaceId: string | null;
  existing: VendorServiceRow | null;
  existingCatalogIds: string[];
  onSaved: () => void | Promise<void>;
}) {
  const [allCatalog, setAllCatalog] = useState<CatalogRow[]>([]);
  const [catalogId, setCatalogId] = useState<string>("");
  const [listPrice, setListPrice] = useState<string>("");
  const [currency, setCurrency] = useState<string>("AED");
  const [quality, setQuality] = useState<VendorServiceQuality>("standard");
  const [leadTimeDays, setLeadTimeDays] = useState<string>("");
  const [minOrder, setMinOrder] = useState<string>("");
  const [allCities, setAllCities] = useState<boolean>(false);
  const [cities, setCities] = useState<string>("");
  const [communities, setCommunities] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data } = await supabase
        .from("service_catalog")
        .select("id, name, code, category")
        .eq("is_active", true)
        .order("name");
      setAllCatalog((data ?? []) as CatalogRow[]);
    })();

    if (existing) {
      setCatalogId(existing.catalog_id);
      setListPrice(existing.list_price?.toString() ?? "");
      setCurrency(existing.currency);
      setQuality(existing.quality_tier);
      setLeadTimeDays(existing.lead_time_days?.toString() ?? "");
      setMinOrder(existing.min_order_amount?.toString() ?? "");
      setAllCities(existing.service_area_all_cities);
      setCities(existing.service_area_cities.join(", "));
      setCommunities(existing.service_area_communities.join(", "));
      setIsActive(existing.is_active);
      setNotes(existing.notes ?? "");
    } else {
      setCatalogId("");
      setListPrice("");
      setCurrency("AED");
      setQuality("standard");
      setLeadTimeDays("");
      setMinOrder("");
      setAllCities(false);
      setCities("");
      setCommunities("");
      setIsActive(true);
      setNotes("");
    }
  }, [open, existing]);

  const availableCatalog = useMemo(
    () =>
      allCatalog.filter(
        (c) => existing?.catalog_id === c.id || !existingCatalogIds.includes(c.id),
      ),
    [allCatalog, existing, existingCatalogIds],
  );

  const save = async () => {
    if (!catalogId) {
      toast.error("Pick a catalog service");
      return;
    }
    setWorking(true);
    const payload = {
      vendor_id: vendorId,
      catalog_id: catalogId,
      workspace_id: workspaceId,
      list_price: listPrice ? Number(listPrice) : null,
      currency,
      quality_tier: quality,
      lead_time_days: leadTimeDays ? Number(leadTimeDays) : null,
      min_order_amount: minOrder ? Number(minOrder) : null,
      service_area_all_cities: allCities,
      service_area_cities: allCities
        ? []
        : cities
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
      service_area_communities: communities
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      is_active: isActive,
      notes: notes.trim() || null,
    };

    const { error } = existing
      ? await supabase.from("vendor_services").update(payload).eq("id", existing.id)
      : await supabase.from("vendor_services").insert(payload);

    setWorking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(existing ? "Service updated" : "Service added");
    onOpenChange(false);
    await onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit service coverage" : "Add service coverage"}</DialogTitle>
          <DialogDescription>
            Define what this vendor offers, where, and at what price.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            <div>
              <Label>Catalog service</Label>
              <Select value={catalogId} onValueChange={setCatalogId} disabled={!!existing}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Pick a service…" />
                </SelectTrigger>
                <SelectContent>
                  {availableCatalog.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{" "}
                      <span className="text-muted-foreground text-xs">· {c.category}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>List price</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                  placeholder="Optional"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quality tier</Label>
                <Select value={quality} onValueChange={(v) => setQuality(v as VendorServiceQuality)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="economy">Economy</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Lead time (days)</Label>
                <Input
                  type="number"
                  min={0}
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                  className="mt-1.5"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div>
              <Label>Minimum order</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                className="mt-1.5"
                placeholder="Optional"
              />
            </div>

            <div className="space-y-3 border hairline rounded-sm p-3">
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">Service all cities</Label>
                <Switch checked={allCities} onCheckedChange={setAllCities} />
              </div>
              {!allCities && (
                <div>
                  <Label className="text-xs">Cities (comma separated)</Label>
                  <Input
                    value={cities}
                    onChange={(e) => setCities(e.target.value)}
                    placeholder="Dubai, Abu Dhabi, Sharjah"
                    className="mt-1.5"
                  />
                </div>
              )}
              <div>
                <Label className="text-xs">Communities / neighborhoods (optional)</Label>
                <Input
                  value={communities}
                  onChange={(e) => setCommunities(e.target.value)}
                  placeholder="JVC, Marina, Downtown"
                  className="mt-1.5"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Leave blank to cover every community within the cities above.
                </p>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1.5"
                placeholder="Anything important about this offering"
              />
            </div>

            <div className="flex items-center justify-between border hairline rounded-sm p-3">
              <div>
                <Label className="cursor-pointer">Active</Label>
                <p className="text-[11px] text-muted-foreground">
                  Inactive services aren't included in auto-invitations.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={working}>
            Cancel
          </Button>
          <Button onClick={save} disabled={working || !catalogId}>
            {working && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {existing ? "Save changes" : "Add service"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}