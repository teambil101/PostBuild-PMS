import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Building2, Home, User, Pencil, Check, X, Upload, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  monthlyEquivalent,
  SECURITY_DEPOSIT_STATUS_LABELS, SECURITY_DEPOSIT_STATUS_STYLES, type SecurityDepositStatus,
  COMMISSION_PAYER_LABELS, type CommissionPayer,
  COMMISSION_STATUS_LABELS, COMMISSION_STATUS_STYLES, type CommissionStatus,
  PAYMENT_FREQUENCY_LABELS, type PaymentFrequency,
} from "@/lib/leases";

interface LeaseData {
  annual_rent: number;
  payment_frequency: PaymentFrequency | string;
  first_cheque_date: string | null;
  security_deposit_amount: number | null;
  security_deposit_status: SecurityDepositStatus | null;
  security_deposit_notes: string | null;
  commission_amount: number | null;
  commission_payer: CommissionPayer | null;
  commission_status: CommissionStatus | null;
  ejari_number: string | null;
}

interface Props {
  lease: LeaseData;
  currency: string;
  tenant: { id: string; name: string } | null;
  unit: { id: string; building_id: string | null; label: string } | null;
  editable?: boolean;
  onSaveEjariNumber?: (value: string | null) => Promise<void>;
  onUploadEjariDoc?: () => void;
}

export function LeaseOverviewBlocks({ lease, currency, tenant, unit, editable, onSaveEjariNumber, onUploadEjariDoc }: Props) {
  const monthly = monthlyEquivalent(Number(lease.annual_rent));
  const [editingEjari, setEditingEjari] = useState(false);
  const [ejariDraft, setEjariDraft] = useState(lease.ejari_number ?? "");
  const [savingEjari, setSavingEjari] = useState(false);

  const startEditEjari = () => {
    setEjariDraft(lease.ejari_number ?? "");
    setEditingEjari(true);
  };
  const cancelEditEjari = () => {
    setEditingEjari(false);
    setEjariDraft(lease.ejari_number ?? "");
  };
  const saveEjari = async () => {
    if (!onSaveEjariNumber) return;
    const v = ejariDraft.trim();
    setSavingEjari(true);
    try {
      await onSaveEjariNumber(v.length ? v : null);
      setEditingEjari(false);
    } finally {
      setSavingEjari(false);
    }
  };
  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Tenant">
          {tenant ? (
            <Link
              to={`/people/${tenant.id}`}
              className="flex items-center gap-2.5 text-architect hover:text-gold-deep group"
            >
              <User className="h-4 w-4 text-true-taupe" strokeWidth={1.5} />
              <span className="text-sm flex-1 truncate">{tenant.name}</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
            </Link>
          ) : (
            <div className="text-sm text-muted-foreground">No tenant on file.</div>
          )}
        </Section>

        <Section title="Unit">
          {unit ? (
            <Link
              to={unit.building_id ? `/properties/${unit.building_id}/units/${unit.id}` : "/properties"}
              className="flex items-center gap-2.5 text-architect hover:text-gold-deep group"
            >
              <Home className="h-4 w-4 text-true-taupe" strokeWidth={1.5} />
              <span className="text-sm flex-1 truncate">{unit.label}</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
            </Link>
          ) : (
            <div className="text-sm text-muted-foreground">No unit linked.</div>
          )}
        </Section>
      </div>

      <Section title="Financial summary">
        <DL>
          <DLRow label="Annual rent" value={<span className="mono">{currency} {Number(lease.annual_rent).toLocaleString()}</span>} />
          <DLRow label="Monthly equivalent" value={<span className="mono text-muted-foreground">{currency} {monthly.toLocaleString()}</span>} />
          <DLRow
            label="Payment frequency"
            value={PAYMENT_FREQUENCY_LABELS[lease.payment_frequency as PaymentFrequency] ?? lease.payment_frequency}
          />
          <DLRow
            label="First cheque"
            value={lease.first_cheque_date ? format(new Date(lease.first_cheque_date), "PPP") : "—"}
          />
        </DL>
      </Section>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Security deposit">
          {lease.security_deposit_amount != null ? (
            <DL>
              <DLRow label="Amount" value={<span className="mono">{currency} {Number(lease.security_deposit_amount).toLocaleString()}</span>} />
              <DLRow
                label="Status"
                value={
                  lease.security_deposit_status ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider font-medium",
                        SECURITY_DEPOSIT_STATUS_STYLES[lease.security_deposit_status],
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {SECURITY_DEPOSIT_STATUS_LABELS[lease.security_deposit_status]}
                    </span>
                  ) : "—"
                }
              />
              {lease.security_deposit_notes && (
                <div className="pt-2 mt-2 border-t hairline">
                  <div className="text-[11px] text-muted-foreground italic whitespace-pre-wrap">{lease.security_deposit_notes}</div>
                </div>
              )}
            </DL>
          ) : (
            <div className="text-sm text-muted-foreground">No deposit recorded.</div>
          )}
        </Section>

        <Section title="Commission">
          {lease.commission_amount != null ? (
            <DL>
              <DLRow label="Amount" value={<span className="mono">{currency} {Number(lease.commission_amount).toLocaleString()}</span>} />
              <DLRow
                label="Paid by"
                value={lease.commission_payer ? COMMISSION_PAYER_LABELS[lease.commission_payer] : "—"}
              />
              <DLRow
                label="Status"
                value={
                  lease.commission_status ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider font-medium",
                        COMMISSION_STATUS_STYLES[lease.commission_status],
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {COMMISSION_STATUS_LABELS[lease.commission_status]}
                    </span>
                  ) : "—"
                }
              />
            </DL>
          ) : (
            <div className="text-sm text-muted-foreground">No commission recorded.</div>
          )}
        </Section>
      </div>

      <Section title="Ejari registration">
        {lease.ejari_number ? (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-true-taupe" strokeWidth={1.5} />
            <span className="text-sm text-architect mono">{lease.ejari_number}</span>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic">Not registered yet.</div>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border hairline rounded-sm bg-card p-5">
      <div className="label-eyebrow mb-3">{title}</div>
      {children}
    </div>
  );
}

function DL({ children }: { children: React.ReactNode }) {
  return <dl className="space-y-1.5">{children}</dl>;
}

function DLRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-architect text-right">{value}</dd>
    </div>
  );
}