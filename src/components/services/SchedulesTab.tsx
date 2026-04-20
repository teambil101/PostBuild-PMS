import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { ServiceScheduleDialog } from "@/components/services/ServiceScheduleDialog";
import {
  FREQUENCY_LABELS, STATUS_LABELS, STATUS_STYLES,
  formatDueCountdown, getScheduleUrgency, urgencyTone,
  type ServiceScheduleRow,
} from "@/lib/services";
import { cn } from "@/lib/utils";

interface Props {
  /** Filter by vendor or by service agreement contract id. */
  filter: { vendorId?: string; serviceAgreementId?: string };
  canEdit: boolean;
  onCountChange?: (n: number) => void;
}

export function SchedulesTab({ filter, canEdit, onCountChange }: Props) {
  const [rows, setRows] = useState<ServiceScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("service_schedules").select("*").order("status").order("next_due_date");
    if (filter.vendorId) q = q.eq("vendor_id", filter.vendorId);
    if (filter.serviceAgreementId) q = q.eq("service_agreement_id", filter.serviceAgreementId);
    const { data } = await q;
    const list = (data ?? []) as unknown as ServiceScheduleRow[];
    setRows(list);
    onCountChange?.(list.length);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [filter.vendorId, filter.serviceAgreementId]);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{rows.length} schedule{rows.length === 1 ? "" : "s"}</div>
        {canEdit && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New schedule
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-10 w-10" strokeWidth={1.25} />}
          title="No service schedules"
          description="Recurring services trigger tickets automatically. Create one to get started."
          action={canEdit ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New schedule</Button> : undefined}
        />
      ) : (
        <div className="border hairline rounded-sm overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b hairline text-left">
              <tr>
                <th className="px-4 py-3 label-eyebrow">Name</th>
                <th className="px-4 py-3 label-eyebrow">Frequency</th>
                <th className="px-4 py-3 label-eyebrow">Next due</th>
                <th className="px-4 py-3 label-eyebrow">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const u = getScheduleUrgency(r.next_due_date, r.lead_time_days);
                return (
                  <tr key={r.id} className="border-b hairline last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to={`/services/${r.id}`} className="text-architect hover:underline">{r.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{FREQUENCY_LABELS[r.frequency]}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-architect">{format(new Date(r.next_due_date + "T00:00:00"), "MMM d, yyyy")}</div>
                      <div className={cn("text-[11px]", urgencyTone(u))}>{formatDueCountdown(r.next_due_date)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-block px-1.5 py-0.5 border rounded-sm text-[10px] uppercase tracking-wider", STATUS_STYLES[r.status])}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ServiceScheduleDialog
        open={open}
        onOpenChange={setOpen}
        prefillVendorId={filter.vendorId}
        prefillAgreementContractId={filter.serviceAgreementId}
        onSaved={() => { setOpen(false); load(); }}
      />
    </div>
  );
}
