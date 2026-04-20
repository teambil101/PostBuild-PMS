import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus, Search, X, CalendarClock, AlertTriangle, Clock, Wrench, Users,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ServiceScheduleDialog } from "@/components/services/ServiceScheduleDialog";
import {
  FREQUENCY_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  formatDueCountdown,
  getScheduleUrgency,
  urgencyTone,
  type Frequency,
  type ScheduleStatus,
  type ServiceScheduleRow,
} from "@/lib/services";
import { format } from "date-fns";

interface Row extends ServiceScheduleRow {
  vendor?: { legal_name: string; display_name: string | null; vendor_number: string } | null;
  agreement?: { contract_number: string; title: string } | null;
}

export default function ServicesPage() {
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [targetLabels, setTargetLabels] = useState<Record<string, string>>({});

  const search = searchParams.get("q") ?? "";
  const statusParam = (searchParams.get("status") ?? "active") as ScheduleStatus | "all";

  const update = (k: string, v: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (v == null || v === "") next.delete(k);
    else next.set(k, v);
    setSearchParams(next, { replace: true });
  };

  const load = async () => {
    setLoading(true);
    const { data: schedules } = await supabase
      .from("service_schedules")
      .select("*, vendor:vendor_id(legal_name, display_name, vendor_number), agreement:service_agreement_id(contract_number, title)")
      .order("status", { ascending: true })
      .order("next_due_date", { ascending: true });
    const list = (schedules ?? []) as unknown as Row[];
    setRows(list);

    // Resolve target labels
    const buildingIds = list.filter((r) => r.target_entity_type === "building").map((r) => r.target_entity_id);
    const unitIds = list.filter((r) => r.target_entity_type === "unit").map((r) => r.target_entity_id);
    const [bRes, uRes] = await Promise.all([
      buildingIds.length
        ? supabase.from("buildings").select("id, name").in("id", buildingIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      unitIds.length
        ? supabase.from("units").select("id, unit_number, building_id, buildings(name)").in("id", unitIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const labels: Record<string, string> = {};
    for (const b of (bRes.data ?? []) as { id: string; name: string }[]) {
      labels[`building:${b.id}`] = b.name;
    }
    for (const u of (uRes.data ?? []) as any[]) {
      labels[`unit:${u.id}`] = `Unit ${u.unit_number} · ${u.buildings?.name ?? ""}`;
    }
    setTargetLabels(labels);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    let active = 0, dueWeek = 0, overdue = 0;
    const vendorSet = new Set<string>();
    for (const r of rows) {
      if (r.status !== "active") continue;
      active++;
      vendorSet.add(r.vendor_id);
      const due = new Date(r.next_due_date + "T00:00:00");
      if (due <= in7) dueWeek++;
      const u = getScheduleUrgency(r.next_due_date, r.lead_time_days);
      if (u === "overdue") overdue++;
    }
    return { active, dueWeek, overdue, vendors: vendorSet.size };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusParam !== "all" && r.status !== statusParam) return false;
      if (q) {
        const blob = [r.name, r.description ?? "", r.notes ?? ""].join(" ").toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusParam]);

  const clearAll = () => setSearchParams({}, { replace: true });

  return (
    <>
      <PageHeader
        eyebrow="Module · 07"
        title="Services"
        description="Recurring services scheduled across your portfolio."
        actions={
          canEdit && (
            <Button variant="gold" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New schedule
            </Button>
          )
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Kpi label="Active schedules" value={kpis.active} icon={<CalendarClock className="h-4 w-4" />} />
        <Kpi label="Due this week" value={kpis.dueWeek} icon={<Clock className="h-4 w-4" />} tone={kpis.dueWeek > 0 ? "amber" : undefined} />
        <Kpi label="Overdue" value={kpis.overdue} icon={<AlertTriangle className="h-4 w-4" />} tone={kpis.overdue > 0 ? "red" : undefined} />
        <Kpi label="Vendors engaged" value={kpis.vendors} icon={<Users className="h-4 w-4" />} />
      </div>

      {/* Filter bar */}
      <div className="border hairline rounded-sm bg-card p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search name, description, notes…"
              value={search}
              onChange={(e) => update("q", e.target.value || null)}
              className="h-9 pl-9"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs">
            <X className="h-3 w-3 mr-1" />
            Clear all
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-eyebrow mr-1">Status</span>
          {(["active", "paused", "ended", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => update("status", s === "active" ? null : s)}
              className={cn(
                "px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider",
                statusParam === s
                  ? "bg-architect text-chalk border-architect"
                  : "bg-card text-muted-foreground border-warm-stone hover:bg-muted/40",
              )}
            >
              {s === "all" ? "All" : STATUS_LABELS[s as ScheduleStatus]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 bg-muted/40 animate-pulse rounded-sm" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-8 w-8" strokeWidth={1.2} />}
          title="No services scheduled yet"
          description="Create your first recurring service to start automating repeat work."
          action={
            canEdit && (
              <Button variant="gold" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                New schedule
              </Button>
            )
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-8 w-8" strokeWidth={1.2} />}
          title="No schedules match these filters"
          action={<Button variant="outline" onClick={clearAll}>Clear filters</Button>}
        />
      ) : (
        <div className="border hairline rounded-sm overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b hairline text-left">
                <tr>
                  <th className="px-4 py-3 label-eyebrow">Name</th>
                  <th className="px-4 py-3 label-eyebrow">Vendor</th>
                  <th className="px-4 py-3 label-eyebrow">Target</th>
                  <th className="px-4 py-3 label-eyebrow">Frequency</th>
                  <th className="px-4 py-3 label-eyebrow">Next due</th>
                  <th className="px-4 py-3 label-eyebrow">Status</th>
                  <th className="px-4 py-3 label-eyebrow">Agreement</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const urgency = getScheduleUrgency(r.next_due_date, r.lead_time_days);
                  const targetLabel = targetLabels[`${r.target_entity_type}:${r.target_entity_id}`] ?? "—";
                  const ended = r.status === "ended";
                  return (
                    <tr
                      key={r.id}
                      className={cn(
                        "border-b hairline last:border-0 hover:bg-muted/30 cursor-pointer",
                        ended && "opacity-60",
                      )}
                      onClick={() => navigate(`/services/${r.id}`)}
                    >
                      <td className="px-4 py-3 max-w-[280px]">
                        <span className="block truncate text-architect">{r.name}</span>
                        {r.description && (
                          <span className="block truncate text-[11px] text-muted-foreground">{r.description}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {r.vendor ? (
                          <Link to={`/vendors/${r.vendor_id}`} onClick={(e) => e.stopPropagation()} className="text-architect hover:underline">
                            {r.vendor.display_name || r.vendor.legal_name}
                          </Link>
                        ) : <span className="text-muted-foreground italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-architect max-w-[220px] truncate">{targetLabel}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="px-1.5 py-0.5 border hairline rounded-sm text-[10px] uppercase tracking-wider text-true-taupe">
                          {FREQUENCY_LABELS[r.frequency as Frequency]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <div className="text-architect">{format(new Date(r.next_due_date + "T00:00:00"), "MMM d, yyyy")}</div>
                        <div className={cn("text-[11px]", urgencyTone(urgency))}>
                          {formatDueCountdown(r.next_due_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-1.5 py-0.5 border rounded-sm text-[10px] uppercase tracking-wider", STATUS_STYLES[r.status])}>
                          {STATUS_LABELS[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {r.agreement ? (
                          <Link
                            to={`/contracts/${r.service_agreement_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="mono text-architect hover:underline"
                          >
                            {r.agreement.contract_number}
                          </Link>
                        ) : <span className="text-muted-foreground italic">None</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ServiceScheduleDialog
        open={open}
        onOpenChange={setOpen}
        onSaved={(id) => { setOpen(false); navigate(`/services/${id}`); }}
      />
    </>
  );
}

function Kpi({
  label, value, icon, tone,
}: { label: string; value: number; icon: React.ReactNode; tone?: "amber" | "red" }) {
  return (
    <div className={cn(
      "border hairline rounded-sm bg-card p-4 flex items-start justify-between gap-3",
      tone === "amber" && "border-amber-500/30",
      tone === "red" && "border-destructive/30",
    )}>
      <div>
        <div className="label-eyebrow mb-1">{label}</div>
        <div className={cn(
          "font-display text-3xl text-architect leading-none",
          tone === "amber" && "text-amber-700",
          tone === "red" && "text-destructive",
        )}>
          {value}
        </div>
      </div>
      <div className="text-true-taupe">{icon}</div>
    </div>
  );
}