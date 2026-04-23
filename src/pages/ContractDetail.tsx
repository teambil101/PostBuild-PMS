import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Building2, Home, Users, History as HistoryIcon, FileBox, StickyNote, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContractStatusBadge } from "@/components/contracts/ContractStatusBadge";
import {
  APPROVAL_RULE_LABEL,
  CONTRACT_TYPE_LABEL,
  FEE_MODEL_LABEL,
  INCLUDED_SERVICES_CATALOG,
  type ContractStatus,
  type ContractType,
} from "@/lib/contracts";
import { formatCurrency } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

interface PartyRow {
  id: string;
  role: string;
  is_primary: boolean;
  person: {
    id: string;
    first_name: string;
    last_name: string;
    company: string | null;
    primary_email: string | null;
    phone: string | null;
  } | null;
}

interface SubjectRow {
  id: string;
  subject_type: "building" | "unit";
  subject_id: string;
  building?: { id: string; name: string; ref_code: string; city: string } | null;
  unit?: { id: string; unit_number: string; ref_code: string; building_id: string; building: { name: string } | null } | null;
}

interface EventRow {
  id: string;
  event_type: string;
  description: string | null;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

interface ContractRow {
  id: string;
  contract_number: string;
  contract_type: ContractType;
  status: ContractStatus;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  signed_date: string | null;
  currency: string;
  notes: string | null;
  created_at: string;
  ma?: {
    fee_model: string;
    fee_percent: number | null;
    fee_flat_annual: number | null;
    fee_flat_per_unit: number | null;
    fee_notes: string | null;
    included_services: string[];
    approval_rule: string;
    approval_threshold_amount: number | null;
    approval_threshold_currency: string | null;
    lease_up_fee_model: string | null;
    lease_up_fee_value: number | null;
    termination_notice_days: number | null;
    auto_renew: boolean;
    renewal_notice_days: number | null;
    repair_authorization_terms: string | null;
    scope_notes: string | null;
  } | null;
}

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = useState<ContractRow | null>(null);
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: c }, { data: ma }, { data: pa }, { data: su }, { data: ev }] = await Promise.all([
      supabase.from("contracts").select("*").eq("id", id).maybeSingle(),
      supabase.from("management_agreements").select("*").eq("contract_id", id).maybeSingle(),
      supabase
        .from("contract_parties")
        .select("id, role, is_primary, person:people(id, first_name, last_name, company, primary_email, phone)")
        .eq("contract_id", id),
      supabase.from("contract_subjects").select("id, subject_type, subject_id").eq("contract_id", id),
      supabase
        .from("contract_events")
        .select("id, event_type, description, from_value, to_value, created_at")
        .eq("contract_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (!c) {
      setLoading(false);
      return;
    }

    // Resolve subjects with their target rows
    const buildingIds = (su ?? []).filter((s: any) => s.subject_type === "building").map((s: any) => s.subject_id);
    const unitIds = (su ?? []).filter((s: any) => s.subject_type === "unit").map((s: any) => s.subject_id);
    const [{ data: bs }, { data: us }] = await Promise.all([
      buildingIds.length
        ? supabase.from("buildings").select("id, name, ref_code, city").in("id", buildingIds)
        : Promise.resolve({ data: [] as any[] }),
      unitIds.length
        ? supabase
            .from("units")
            .select("id, unit_number, ref_code, building_id, building:buildings(name)")
            .in("id", unitIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const bMap = Object.fromEntries((bs ?? []).map((b: any) => [b.id, b]));
    const uMap = Object.fromEntries((us ?? []).map((u: any) => [u.id, u]));
    const subjectsResolved: SubjectRow[] = (su ?? []).map((s: any) => ({
      ...s,
      building: s.subject_type === "building" ? bMap[s.subject_id] ?? null : null,
      unit: s.subject_type === "unit" ? uMap[s.subject_id] ?? null : null,
    }));

    setContract({ ...(c as any), ma: (ma as any) ?? null });
    setParties((pa as any) ?? []);
    setSubjects(subjectsResolved);
    setEvents((ev as any) ?? []);
    setLoading(false);
  };

  const updateStatus = async (next: ContractStatus, label: string) => {
    if (!contract) return;
    const { error } = await supabase.from("contracts").update({ status: next }).eq("id", contract.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("contract_events").insert({
      contract_id: contract.id,
      event_type: "status_change",
      description: label,
      from_value: contract.status,
      to_value: next,
    });
    toast.success(label);
    await load();
  };

  if (loading) return <div className="text-sm text-muted-foreground py-12 text-center">Loading contract…</div>;
  if (!contract) {
    return (
      <EmptyState
        icon={<FileText className="h-10 w-10" strokeWidth={1.2} />}
        title="Contract not found"
        description="It may have been deleted, or the link is wrong."
        action={<Button onClick={() => navigate("/contracts")}>Back to contracts</Button>}
      />
    );
  }

  const ma = contract.ma;

  return (
    <>
      <PageHeader
        eyebrow={`${contract.contract_number} · ${CONTRACT_TYPE_LABEL[contract.contract_type]}`}
        title={contract.title || CONTRACT_TYPE_LABEL[contract.contract_type]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/contracts")}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {contract.status === "draft" && (
              <Button onClick={() => updateStatus("pending_signature", "Marked as pending signature")}>
                Send for signature
              </Button>
            )}
            {contract.status === "pending_signature" && (
              <Button onClick={() => updateStatus("active", "Activated")}>
                <CheckCircle2 className="h-4 w-4" />
                Activate
              </Button>
            )}
            {contract.status === "active" && (
              <Button variant="outline" onClick={() => updateStatus("terminated", "Terminated")}>
                <XCircle className="h-4 w-4" />
                Terminate
              </Button>
            )}
          </div>
        }
      />

      {/* Status row */}
      <div className="mb-6 flex flex-wrap items-center gap-3 -mt-4">
        <ContractStatusBadge status={contract.status} />
        {contract.start_date && (
          <div className="text-xs text-muted-foreground">
            <span className="mono uppercase tracking-wider">Period:</span>{" "}
            {new Date(contract.start_date).toLocaleDateString()}
            {contract.end_date && ` → ${new Date(contract.end_date).toLocaleDateString()}`}
          </div>
        )}
        {contract.signed_date && (
          <div className="text-xs text-muted-foreground">
            <span className="mono uppercase tracking-wider">Signed:</span> {new Date(contract.signed_date).toLocaleDateString()}
          </div>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="parties">Parties ({parties.length})</TabsTrigger>
          <TabsTrigger value="properties">Properties ({subjects.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="history">History ({events.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {ma ? (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <DetailCard title="Fee structure">
                  <Row label="Model" value={FEE_MODEL_LABEL[ma.fee_model as keyof typeof FEE_MODEL_LABEL] ?? ma.fee_model} />
                  {ma.fee_percent !== null && <Row label="Percent" value={`${ma.fee_percent}%`} />}
                  {ma.fee_flat_annual !== null && (
                    <Row label="Flat annual" value={formatCurrency(ma.fee_flat_annual, contract.currency)} />
                  )}
                  {ma.fee_flat_per_unit !== null && (
                    <Row label="Per unit / year" value={formatCurrency(ma.fee_flat_per_unit, contract.currency)} />
                  )}
                  {ma.fee_notes && <Row label="Notes" value={ma.fee_notes} />}
                </DetailCard>

                <DetailCard title="Approval rule">
                  <Row
                    label="Rule"
                    value={APPROVAL_RULE_LABEL[ma.approval_rule as keyof typeof APPROVAL_RULE_LABEL] ?? ma.approval_rule}
                  />
                  {ma.approval_threshold_amount !== null && (
                    <Row
                      label="Threshold"
                      value={formatCurrency(ma.approval_threshold_amount, ma.approval_threshold_currency ?? contract.currency)}
                    />
                  )}
                </DetailCard>

                <DetailCard title="Lease-up & terms">
                  {ma.lease_up_fee_model && <Row label="Lease-up model" value={ma.lease_up_fee_model.replace(/_/g, " ")} />}
                  {ma.lease_up_fee_value !== null && <Row label="Lease-up value" value={String(ma.lease_up_fee_value)} />}
                  {ma.termination_notice_days && <Row label="Termination notice" value={`${ma.termination_notice_days} days`} />}
                  <Row label="Auto-renew" value={ma.auto_renew ? "Yes" : "No"} />
                  {ma.auto_renew && ma.renewal_notice_days && (
                    <Row label="Renewal notice" value={`${ma.renewal_notice_days} days`} />
                  )}
                </DetailCard>

                <DetailCard title="Included free services">
                  {ma.included_services.length === 0 ? (
                    <div className="text-xs text-muted-foreground">None — every service requested will be billed.</div>
                  ) : (
                    <ul className="space-y-1">
                      {ma.included_services.map((key) => {
                        const item = INCLUDED_SERVICES_CATALOG.find((s) => s.key === key);
                        return (
                          <li key={key} className="flex items-center gap-2 text-sm text-architect">
                            <CheckCircle2 className="h-3.5 w-3.5 text-status-occupied shrink-0" />
                            {item?.label ?? key}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </DetailCard>
              </div>

              {(ma.repair_authorization_terms || ma.scope_notes) && (
                <DetailCard title="Notes">
                  {ma.repair_authorization_terms && (
                    <div className="mb-3">
                      <div className="label-eyebrow text-muted-foreground mb-1">Repair authorization</div>
                      <p className="text-sm text-architect whitespace-pre-wrap">{ma.repair_authorization_terms}</p>
                    </div>
                  )}
                  {ma.scope_notes && (
                    <div>
                      <div className="label-eyebrow text-muted-foreground mb-1">Scope notes</div>
                      <p className="text-sm text-architect whitespace-pre-wrap">{ma.scope_notes}</p>
                    </div>
                  )}
                </DetailCard>
              )}
            </>
          ) : (
            <DetailCard title="Overview">
              <div className="text-sm text-muted-foreground">Subtype details not available.</div>
            </DetailCard>
          )}
        </TabsContent>

        <TabsContent value="parties" className="mt-6">
          {parties.length === 0 ? (
            <EmptyState icon={<Users className="h-10 w-10" strokeWidth={1.2} />} title="No parties recorded" />
          ) : (
            <div className="border hairline rounded-sm bg-card divide-y hairline">
              {parties.map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-center gap-4">
                  <div className="label-eyebrow w-32 text-muted-foreground">{p.role.replace(/_/g, " ")}</div>
                  {p.person ? (
                    <Link to={`/people/${p.person.id}`} className="flex-1 text-sm text-architect hover:text-gold">
                      {p.person.company || `${p.person.first_name} ${p.person.last_name}`}
                      {p.person.company && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({p.person.first_name} {p.person.last_name})
                        </span>
                      )}
                    </Link>
                  ) : (
                    <div className="flex-1 text-sm text-muted-foreground">—</div>
                  )}
                  <div className="text-xs text-muted-foreground hidden md:block">{p.person?.primary_email ?? p.person?.phone ?? ""}</div>
                  {p.is_primary && (
                    <span className="text-[10px] uppercase tracking-wider text-gold">Primary</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="properties" className="mt-6">
          {subjects.length === 0 ? (
            <EmptyState icon={<Building2 className="h-10 w-10" strokeWidth={1.2} />} title="No properties covered" />
          ) : (
            <div className="border hairline rounded-sm bg-card divide-y hairline">
              {subjects.map((s) => (
                <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                  {s.subject_type === "building" ? (
                    <Building2 className="h-4 w-4 text-architect/60" strokeWidth={1.5} />
                  ) : (
                    <Home className="h-4 w-4 text-architect/60" strokeWidth={1.5} />
                  )}
                  {s.subject_type === "building" && s.building ? (
                    <Link to={`/properties/${s.building.id}`} className="flex-1 text-sm text-architect hover:text-gold">
                      {s.building.name}
                      <span className="mono text-[10px] text-muted-foreground ml-2">{s.building.ref_code}</span>
                      <span className="text-xs text-muted-foreground ml-2">· {s.building.city}</span>
                    </Link>
                  ) : s.subject_type === "unit" && s.unit ? (
                    <Link
                      to={`/properties/${s.unit.building_id}/units/${s.unit.id}`}
                      className="flex-1 text-sm text-architect hover:text-gold"
                    >
                      {s.unit.building?.name ?? "—"} · Unit {s.unit.unit_number}
                      <span className="mono text-[10px] text-muted-foreground ml-2">{s.unit.ref_code}</span>
                    </Link>
                  ) : (
                    <div className="flex-1 text-sm text-muted-foreground">Reference removed</div>
                  )}
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.subject_type}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <EmptyState
            icon={<FileBox className="h-10 w-10" strokeWidth={1.2} />}
            title="Document attachments"
            description="Upload signed PDFs, addendums, and supporting docs. Coming next pass."
          />
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <EmptyState
            icon={<StickyNote className="h-10 w-10" strokeWidth={1.2} />}
            title="Notes"
            description="Internal notes thread for this contract. Coming next pass."
          />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {events.length === 0 ? (
            <EmptyState icon={<HistoryIcon className="h-10 w-10" strokeWidth={1.2} />} title="No events yet" />
          ) : (
            <div className="border hairline rounded-sm bg-card divide-y hairline">
              {events.map((e) => (
                <div key={e.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm text-architect">{e.description || e.event_type.replace(/_/g, " ")}</div>
                    <div className="mono text-[10px] text-muted-foreground shrink-0">
                      {new Date(e.created_at).toLocaleString()}
                    </div>
                  </div>
                  {(e.from_value || e.to_value) && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {e.from_value ? <span className="mono">{e.from_value}</span> : <span>—</span>} →{" "}
                      {e.to_value ? <span className="mono">{e.to_value}</span> : <span>—</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border hairline rounded-sm bg-card p-5">
      <div className="label-eyebrow text-muted-foreground mb-3">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <div className="w-32 shrink-0 text-xs text-muted-foreground capitalize">{label}</div>
      <div className="text-architect flex-1">{value}</div>
    </div>
  );
}