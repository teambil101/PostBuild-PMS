import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ContractStatusPill } from "@/components/contracts/StatusPill";
import { DocumentList } from "@/components/attachments/DocumentList";
import {
  CONTRACT_TYPE_LABELS, type ContractType, type ContractStatus,
  formatContractValue, summarizePeriod, daysUntil,
  SCOPE_LABELS, type ScopeService, FEE_MODEL_LABELS,
} from "@/lib/contracts";
import {
  Loader2, Building2, Home, ExternalLink, Pencil, Trash2, Power, FileSignature, XCircle, Copy as CopyIcon,
  ArrowLeft, History as HistoryIcon, AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Contract {
  id: string;
  contract_type: ContractType;
  contract_number: string;
  external_reference: string | null;
  title: string;
  status: ContractStatus;
  start_date: string | null;
  end_date: string | null;
  auto_renew: boolean;
  currency: string;
  total_value: number | null;
  notes: string | null;
  created_at: string;
}

interface MA {
  contract_id: string;
  fee_model: string;
  fee_value: number;
  fee_applies_to: string | null;
  lease_up_fee_model: string | null;
  lease_up_fee_value: number | null;
  hybrid_base_flat: number | null;
  hybrid_threshold: number | null;
  hybrid_overage_percentage: number | null;
  repair_approval_threshold: number | null;
  termination_notice_days: number | null;
  scope_of_services: string[];
  scope_of_services_other: string | null;
}

interface PartyRow {
  id: string; person_id: string; role: string; is_signatory: boolean; signed_at: string | null;
  person?: { first_name: string; last_name: string; company: string | null };
}
interface SubjectRow {
  id: string; entity_type: "building" | "unit"; entity_id: string;
  entity_label?: string; building_id?: string;
}
interface EventRow {
  id: string; event_type: string; from_value: string | null; to_value: string | null;
  description: string | null; actor_id: string | null; created_at: string;
}

const DISABLED_TIP = "Coming in next update";

export default function ContractDetail() {
  const { contractId } = useParams<{ contractId: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [ma, setMa] = useState<MA | null>(null);
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contractId) return;
    (async () => {
      setLoading(true);
      const [cRes, maRes, pRes, sRes, eRes] = await Promise.all([
        supabase.from("contracts").select("*").eq("id", contractId).maybeSingle(),
        supabase.from("management_agreements").select("*").eq("contract_id", contractId).maybeSingle(),
        supabase
          .from("contract_parties")
          .select("id, person_id, role, is_signatory, signed_at, people(first_name, last_name, company)")
          .eq("contract_id", contractId),
        supabase.from("contract_subjects").select("*").eq("contract_id", contractId),
        supabase.from("contract_events").select("*").eq("contract_id", contractId).order("created_at", { ascending: false }),
      ]);
      setContract(cRes.data as Contract | null);
      setMa(maRes.data as MA | null);
      setParties(((pRes.data ?? []) as any[]).map((p) => ({ ...p, person: p.people })));
      setEvents((eRes.data ?? []) as EventRow[]);

      // Resolve subject labels
      const subjList = (sRes.data ?? []) as SubjectRow[];
      const buildingIds = subjList.filter((s) => s.entity_type === "building").map((s) => s.entity_id);
      const unitIds = subjList.filter((s) => s.entity_type === "unit").map((s) => s.entity_id);
      const [bRes, uRes] = await Promise.all([
        buildingIds.length
          ? supabase.from("buildings").select("id, name").in("id", buildingIds)
          : Promise.resolve({ data: [] as any[] }),
        unitIds.length
          ? supabase.from("units").select("id, unit_number, building_id, buildings(name)").in("id", unitIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const bMap = new Map<string, string>();
      ((bRes.data ?? []) as any[]).forEach((b) => bMap.set(b.id, b.name));
      const uMap = new Map<string, { label: string; building_id: string }>();
      ((uRes.data ?? []) as any[]).forEach((u) =>
        uMap.set(u.id, { label: `${u.buildings?.name ?? ""} · ${u.unit_number}`, building_id: u.building_id }),
      );
      setSubjects(
        subjList.map((s) => ({
          ...s,
          entity_label:
            s.entity_type === "building"
              ? bMap.get(s.entity_id) ?? "(deleted)"
              : uMap.get(s.entity_id)?.label ?? "(deleted)",
          building_id: s.entity_type === "unit" ? uMap.get(s.entity_id)?.building_id : undefined,
        })),
      );
      setLoading(false);
    })();
  }, [contractId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-24 justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!contract) {
    return (
      <div className="text-center py-24">
        <div className="text-lg text-muted-foreground mb-4">Contract not found.</div>
        <Button variant="outline" asChild><Link to="/contracts"><ArrowLeft className="h-4 w-4" /> Back to contracts</Link></Button>
      </div>
    );
  }

  const lifecycleHint = (() => {
    if (contract.status !== "active" || !contract.end_date) return null;
    const d = daysUntil(contract.end_date);
    if (d == null) return null;
    if (d < 0) return `Overdue by ${Math.abs(d)} days`;
    if (d === 0) return "Expires today";
    return `Expires in ${d} days`;
  })();

  const partyName = (p: PartyRow) =>
    p.person?.company || `${p.person?.first_name ?? ""} ${p.person?.last_name ?? ""}`.trim();

  const partiesPair = (() => {
    if (parties.length < 2) return parties.map(partyName).join(" ");
    return `${partyName(parties[0])} ↔ ${partyName(parties[1])}`;
  })();

  const DisabledBtn = ({ icon: Icon, label }: { icon: any; label: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>
          <Button variant="outline" size="sm" disabled>
            <Icon className="h-4 w-4" /> {label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{DISABLED_TIP}</TooltipContent>
    </Tooltip>
  );

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="mono text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Link to="/" className="hover:text-architect">Home</Link>
          <span>/</span>
          <Link to="/contracts" className="hover:text-architect">Contracts</Link>
        </div>
        <div className="label-eyebrow text-gold-deep mb-2">
          {CONTRACT_TYPE_LABELS[contract.contract_type]} · <span className="mono">{contract.contract_number}</span>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pb-6 border-b hairline">
          <div className="space-y-1.5 max-w-3xl">
            <h1 className="font-display text-4xl text-architect leading-tight">{contract.title}</h1>
            {(partiesPair || contract.start_date) && (
              <p className="text-sm text-muted-foreground">
                {partiesPair}
                {partiesPair && contract.start_date && " · "}
                {summarizePeriod(contract.start_date, contract.end_date)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DisabledBtn icon={Pencil} label="Edit" />
            {(contract.status === "draft" || contract.status === "pending_signature") && (
              <DisabledBtn icon={Power} label="Activate" />
            )}
            {contract.status === "pending_signature" && <DisabledBtn icon={FileSignature} label="Mark as signed" />}
            {contract.status === "active" && <DisabledBtn icon={XCircle} label="Terminate" />}
            <DisabledBtn icon={CopyIcon} label="Duplicate" />
            {contract.status === "draft" && <DisabledBtn icon={Trash2} label="Delete" />}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <SummaryCard label="Status">
          <div className="space-y-1.5">
            <ContractStatusPill status={contract.status} />
            {lifecycleHint && <div className="text-[11px] text-muted-foreground">{lifecycleHint}</div>}
          </div>
        </SummaryCard>
        <SummaryCard label="Type">
          <div className="text-sm text-architect">{CONTRACT_TYPE_LABELS[contract.contract_type]}</div>
        </SummaryCard>
        <SummaryCard label="Fee / Value">
          <div className="text-sm text-architect">
            {ma ? formatContractValue(ma.fee_model as any, ma.fee_value, ma.fee_applies_to, contract.currency) : "—"}
          </div>
        </SummaryCard>
        <SummaryCard label="Subjects">
          <div className="text-sm text-architect">{subjects.length} {subjects.length === 1 ? "property" : "properties"}</div>
        </SummaryCard>
        <SummaryCard label="Period">
          <div className="text-xs text-architect">{summarizePeriod(contract.start_date, contract.end_date)}</div>
          {contract.auto_renew && <div className="text-[10px] mono uppercase text-gold-deep mt-1">Auto-renew</div>}
        </SummaryCard>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="parties">Parties ({parties.length})</TabsTrigger>
          <TabsTrigger value="subjects">Subjects ({subjects.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {ma ? (
            <>
              <Section title="Fee structure">
                <DL>
                  <DLRow label="Model" value={FEE_MODEL_LABELS[ma.fee_model as keyof typeof FEE_MODEL_LABELS] ?? ma.fee_model} />
                  <DLRow
                    label="Value"
                    value={formatContractValue(ma.fee_model as any, ma.fee_value, ma.fee_applies_to, contract.currency)}
                  />
                  {ma.fee_model === "hybrid" && (
                    <>
                      <DLRow label="Base flat (annual)" value={`${contract.currency} ${Number(ma.hybrid_base_flat).toLocaleString()}`} />
                      <DLRow label="Threshold" value={`${contract.currency} ${Number(ma.hybrid_threshold).toLocaleString()}`} />
                      <DLRow label="Overage %" value={`${ma.hybrid_overage_percentage}%`} />
                    </>
                  )}
                  {ma.lease_up_fee_model && ma.lease_up_fee_model !== "none" && (
                    <DLRow
                      label="Lease-up fee"
                      value={`${ma.lease_up_fee_value ?? "—"} ${ma.lease_up_fee_model === "percentage" ? "%" : contract.currency}`}
                    />
                  )}
                  {ma.repair_approval_threshold != null && (
                    <DLRow label="Repair approval threshold" value={`${contract.currency} ${Number(ma.repair_approval_threshold).toLocaleString()}`} />
                  )}
                </DL>
              </Section>

              <Section title="Scope of services">
                {ma.scope_of_services.length === 0 && !ma.scope_of_services_other ? (
                  <div className="text-sm text-muted-foreground">No services listed.</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {ma.scope_of_services.map((s) => (
                      <span key={s} className="text-xs bg-warm-stone/40 text-architect px-2 py-1 rounded-sm border hairline">
                        {SCOPE_LABELS[s as ScopeService] ?? s}
                      </span>
                    ))}
                    {ma.scope_of_services_other && (
                      <span className="text-xs bg-warm-stone/30 text-muted-foreground px-2 py-1 rounded-sm border hairline italic">
                        + {ma.scope_of_services_other}
                      </span>
                    )}
                  </div>
                )}
              </Section>

              <Section title="Terms">
                <DL>
                  <DLRow label="Start" value={contract.start_date ? format(new Date(contract.start_date), "PPP") : "—"} />
                  <DLRow label="End" value={contract.end_date ? format(new Date(contract.end_date), "PPP") : "—"} />
                  <DLRow label="Auto-renew" value={contract.auto_renew ? "Yes" : "No"} />
                  <DLRow label="Termination notice" value={ma.termination_notice_days != null ? `${ma.termination_notice_days} days` : "—"} />
                </DL>
              </Section>
            </>
          ) : (
            <Section title="Terms">
              <DL>
                <DLRow label="Start" value={contract.start_date ? format(new Date(contract.start_date), "PPP") : "—"} />
                <DLRow label="End" value={contract.end_date ? format(new Date(contract.end_date), "PPP") : "—"} />
                <DLRow label="Auto-renew" value={contract.auto_renew ? "Yes" : "No"} />
              </DL>
            </Section>
          )}

          {contract.notes && (
            <Section title="Notes">
              <p className="text-sm text-architect whitespace-pre-wrap">{contract.notes}</p>
            </Section>
          )}
        </TabsContent>

        <TabsContent value="parties" className="mt-6">
          {parties.length === 0 ? (
            <div className="border hairline rounded-sm bg-card p-6 text-sm text-muted-foreground text-center">
              No parties recorded.
            </div>
          ) : (
            <div className="border hairline rounded-sm bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b hairline text-left">
                  <tr>
                    <th className="px-4 py-3 label-eyebrow">Person</th>
                    <th className="px-4 py-3 label-eyebrow">Role</th>
                    <th className="px-4 py-3 label-eyebrow">Signatory</th>
                    <th className="px-4 py-3 label-eyebrow">Signed</th>
                  </tr>
                </thead>
                <tbody>
                  {parties.map((p) => (
                    <tr key={p.id} className="border-b hairline last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link to={`/people/${p.person_id}`} className="text-architect hover:text-gold-deep inline-flex items-center gap-1">
                          {partyName(p)} <ExternalLink className="h-3 w-3 opacity-50" />
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{p.role.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.is_signatory ? "Yes" : "No"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {p.signed_at ? format(new Date(p.signed_at), "PPP") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="subjects" className="mt-6">
          {subjects.length === 0 ? (
            <div className="border hairline rounded-sm bg-card p-6 text-sm text-muted-foreground text-center">
              No properties linked.
            </div>
          ) : (
            <div className="border hairline rounded-sm bg-card divide-y divide-warm-stone">
              {subjects.map((s) => {
                const Icon = s.entity_type === "building" ? Building2 : Home;
                const href =
                  s.entity_type === "building"
                    ? `/properties/${s.entity_id}`
                    : s.building_id
                      ? `/properties/${s.building_id}/units/${s.entity_id}`
                      : "/properties";
                return (
                  <Link
                    key={s.id}
                    to={href}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30"
                  >
                    <Icon className="h-4 w-4 text-true-taupe" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-architect truncate">{s.entity_label}</div>
                      <div className="text-[11px] text-muted-foreground capitalize">{s.entity_type}</div>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <DocumentList entityType="contract" entityId={contract.id} editable={false} />
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <div className="border hairline rounded-sm bg-card p-6 text-sm text-muted-foreground flex items-center gap-2 justify-center">
            <AlertCircle className="h-4 w-4" /> Notes composer coming in next update.
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {events.length === 0 ? (
            <div className="border hairline rounded-sm bg-card p-6 text-sm text-muted-foreground text-center">
              No events recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.id} className="border hairline rounded-sm bg-card p-3 flex items-start gap-3">
                  <div className="h-7 w-7 rounded-sm bg-warm-stone/50 flex items-center justify-center shrink-0 mt-0.5">
                    <HistoryIcon className="h-3.5 w-3.5 text-true-taupe" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-architect">
                      {e.description ?? e.event_type.replace(/_/g, " ")}
                      {e.from_value && e.to_value && (
                        <span className="text-muted-foreground ml-1.5 text-xs">
                          ({e.from_value} → {e.to_value})
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mono">
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border hairline rounded-sm bg-card p-3">
      <div className="label-eyebrow mb-1.5">{label}</div>
      {children}
    </div>
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