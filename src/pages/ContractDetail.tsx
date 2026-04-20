import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EntityTicketsTab, type TicketSection } from "@/components/tickets/EntityTicketsTab";
import { ContractStatusPill } from "@/components/contracts/StatusPill";
import { DocumentList } from "@/components/attachments/DocumentList";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { ManagementAgreementWizard } from "@/components/contracts/ManagementAgreementWizard";
import { LeaseSummaryCards } from "@/components/contracts/lease/LeaseSummaryCards";
import { LeaseOverviewBlocks } from "@/components/contracts/lease/LeaseOverviewBlocks";
import { ChequesTab } from "@/components/contracts/lease/ChequesTab";
import { ActivateContractDialog } from "@/components/contracts/dialogs/ActivateContractDialog";
import { MarkSignedDialog } from "@/components/contracts/dialogs/MarkSignedDialog";
import { TerminateContractDialog } from "@/components/contracts/dialogs/TerminateContractDialog";
import { DeleteContractDialog } from "@/components/contracts/dialogs/DeleteContractDialog";
import { AddPartyDialog } from "@/components/contracts/dialogs/AddPartyDialog";
import { AddSubjectDialog } from "@/components/contracts/dialogs/AddSubjectDialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  CONTRACT_TYPE_LABELS, type ContractType, type ContractStatus,
  formatContractValue, summarizePeriod, daysUntil, duplicateContract,
  SCOPE_LABELS, type ScopeService, FEE_MODEL_LABELS, PARTY_ROLES,
  getAllowedPartyRoles,
} from "@/lib/contracts";
import { formatEnumLabel } from "@/lib/format";
import {
  Loader2, Building2, Home, ExternalLink, Pencil, Trash2, Power, FileSignature, XCircle, Copy as CopyIcon,
  ArrowLeft, History as HistoryIcon, Plus, Check, X, AlertTriangle,
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

interface LeaseRow {
  id: string;
  contract_id: string;
  annual_rent: number;
  payment_frequency: string;
  first_cheque_date: string | null;
  security_deposit_amount: number | null;
  security_deposit_status: string | null;
  security_deposit_notes: string | null;
  commission_amount: number | null;
  commission_payer: string | null;
  commission_status: string | null;
  ejari_number: string | null;
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

export default function ContractDetail() {
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const { contractId } = useParams<{ contractId: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [ma, setMa] = useState<MA | null>(null);
  const [lease, setLease] = useState<LeaseRow | null>(null);
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selfPersonId, setSelfPersonId] = useState<string | null>(null);

  // Action dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [postSignActivateOpen, setPostSignActivateOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addPartyOpen, setAddPartyOpen] = useState(false);
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [ticketCount, setTicketCount] = useState<number>(0);

  // Inline edit state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [editingExtRef, setEditingExtRef] = useState(false);
  const [extRefDraft, setExtRefDraft] = useState("");
  const [editingNoticeDays, setEditingNoticeDays] = useState(false);
  const [noticeDaysDraft, setNoticeDaysDraft] = useState("");
  const [confirmAutoRenewOpen, setConfirmAutoRenewOpen] = useState(false);
  const [pendingAutoRenew, setPendingAutoRenew] = useState<boolean | null>(null);

  // Party row inline editing & deletion
  const [removePartyTarget, setRemovePartyTarget] = useState<PartyRow | null>(null);
  const [removeSubjectTarget, setRemoveSubjectTarget] = useState<SubjectRow | null>(null);

  const reloadAll = async () => {
    if (!contractId) return;
    setLoading(true);
    const [cRes, maRes, lRes, pRes, sRes, eRes, settingsRes] = await Promise.all([
      supabase.from("contracts").select("*").eq("id", contractId).maybeSingle(),
      supabase.from("management_agreements").select("*").eq("contract_id", contractId).maybeSingle(),
      supabase.from("leases" as never).select("*").eq("contract_id" as never, contractId as never).maybeSingle(),
      supabase
        .from("contract_parties")
        .select("id, person_id, role, is_signatory, signed_at, people(first_name, last_name, company)")
        .eq("contract_id", contractId),
      supabase.from("contract_subjects").select("*").eq("contract_id", contractId),
      supabase.from("contract_events").select("*").eq("contract_id", contractId).order("created_at", { ascending: false }),
      supabase.from("app_settings").select("self_person_id").maybeSingle(),
    ]);
    setContract(cRes.data as Contract | null);
    setMa(maRes.data as MA | null);
    setLease((lRes.data ?? null) as unknown as LeaseRow | null);
    setParties(((pRes.data ?? []) as any[]).map((p) => ({ ...p, person: p.people })));
    setEvents((eRes.data ?? []) as EventRow[]);
    setSelfPersonId((settingsRes.data?.self_person_id as string) ?? null);

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
  };

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Lease-specific derivations
  const leaseTenant = (() => {
    const t = parties.find((p) => p.role === "tenant");
    return t ? { id: t.person_id, name: partyName(t) } : null;
  })();
  const leaseUnit = (() => {
    const u = subjects.find((s) => s.entity_type === "unit");
    return u
      ? { id: u.entity_id, building_id: u.building_id ?? null, label: u.entity_label ?? "(deleted)" }
      : null;
  })();

  const isImmutable = contract.status === "expired" || contract.status === "cancelled";
  const isActive = contract.status === "active";
  const isDraft = contract.status === "draft";
  const isPending = contract.status === "pending_signature";
  const isTerminated = contract.status === "terminated";

  // Action handlers
  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const newId = await duplicateContract(contract.id);
      toast.success(`Draft created from ${contract.contract_number}.`);
      navigate(`/contracts/${newId}`);
    } catch (e: any) {
      toast.error(e.message ?? "Could not duplicate.");
    } finally {
      setDuplicating(false);
    }
  };

  const logEvent = async (event_type: string, description: string, from_value?: string, to_value?: string) => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("contract_events").insert({
      contract_id: contract.id,
      event_type,
      from_value: from_value ?? null,
      to_value: to_value ?? null,
      description,
      actor_id: u.user?.id,
    });
  };

  // Inline saves
  const saveNotes = async () => {
    const v = notesDraft.trim() || null;
    const { error } = await supabase.from("contracts").update({ notes: v, updated_at: new Date().toISOString() }).eq("id", contract.id);
    if (error) { toast.error(error.message); return; }
    await logEvent("amended", "Updated notes");
    toast.success("Notes saved.");
    setEditingNotes(false);
    reloadAll();
  };

  const saveExtRef = async () => {
    const v = extRefDraft.trim() || null;
    const { error } = await supabase.from("contracts").update({ external_reference: v, updated_at: new Date().toISOString() }).eq("id", contract.id);
    if (error) { toast.error(error.message); return; }
    await logEvent("amended", "Updated external reference");
    toast.success("Reference saved.");
    setEditingExtRef(false);
    reloadAll();
  };

  const saveNoticeDays = async () => {
    const n = parseInt(noticeDaysDraft, 10);
    if (!Number.isFinite(n) || n < 0) { toast.error("Enter a valid number of days."); return; }
    const { error } = await supabase.from("management_agreements").update({ termination_notice_days: n, updated_at: new Date().toISOString() }).eq("contract_id", contract.id);
    if (error) { toast.error(error.message); return; }
    await logEvent("amended", `Termination notice set to ${n} days`);
    toast.success("Notice period saved.");
    setEditingNoticeDays(false);
    reloadAll();
  };

  const saveEjariNumber = async (value: string | null) => {
    if (!lease) return;
    const prev = lease.ejari_number;
    const { error } = await supabase
      .from("leases" as never)
      .update({ ejari_number: value, updated_at: new Date().toISOString() } as never)
      .eq("contract_id" as never, contract.id as never);
    if (error) { toast.error(error.message); throw error; }
    await logEvent(
      "amended",
      value ? `Ejari number set to ${value}` : "Ejari number cleared",
      prev ?? undefined,
      value ?? undefined,
    );
    toast.success("Ejari registration saved.");
    reloadAll();
  };

  const handleAutoRenewToggle = (next: boolean) => {
    if (isActive) {
      setPendingAutoRenew(next);
      setConfirmAutoRenewOpen(true);
    } else {
      void doAutoRenewSave(next);
    }
  };

  const doAutoRenewSave = async (next: boolean) => {
    const { error } = await supabase.from("contracts").update({ auto_renew: next, updated_at: new Date().toISOString() }).eq("id", contract.id);
    if (error) { toast.error(error.message); return; }
    await logEvent("amended", `Auto-renew ${next ? "enabled" : "disabled"}`);
    toast.success("Auto-renew updated.");
    setConfirmAutoRenewOpen(false);
    setPendingAutoRenew(null);
    reloadAll();
  };

  const updatePartyRole = async (partyId: string, role: string) => {
    const { error } = await supabase.from("contract_parties").update({ role }).eq("id", partyId);
    if (error) { toast.error(error.message); return; }
    await logEvent("amended", `Party role changed to ${formatEnumLabel(role)}`);
    toast.success("Role updated.");
    reloadAll();
  };

  const removeParty = async () => {
    if (!removePartyTarget) return;
    const name = partyName(removePartyTarget);
    const { error } = await supabase.from("contract_parties").delete().eq("id", removePartyTarget.id);
    if (error) { toast.error(error.message); return; }
    await logEvent("party_removed", `Removed ${name} (${formatEnumLabel(removePartyTarget.role)})`);
    toast.success("Party removed.");
    setRemovePartyTarget(null);
    reloadAll();
  };

  const removeSubject = async () => {
    if (!removeSubjectTarget) return;
    const { error } = await supabase.from("contract_subjects").delete().eq("id", removeSubjectTarget.id);
    if (error) { toast.error(error.message); return; }
    await logEvent("subject_removed", `Removed ${removeSubjectTarget.entity_label ?? removeSubjectTarget.entity_type}`);
    toast.success("Property removed.");
    setRemoveSubjectTarget(null);
    reloadAll();
  };

  // After signatures: maybe auto-activate
  const onSignaturesSaved = (allSigned: boolean) => {
    reloadAll();
    if (allSigned && isPending) setPostSignActivateOpen(true);
  };

  const activateAfterSign = async () => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("contracts")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", contract.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("contract_events").insert({
      contract_id: contract.id,
      event_type: "status_changed",
      from_value: "pending_signature",
      to_value: "active",
      description: "Activated after signatures",
      actor_id: u.user?.id,
    });
    toast.success("Contract activated.");
    setPostSignActivateOpen(false);
    reloadAll();
  };

  const existingPartyPersonIds = parties.map((p) => p.person_id);
  const existingSubjectKeys = subjects.map((s) => `${s.entity_type}:${s.entity_id}`);

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
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              {!isImmutable && contract.contract_type === "management_agreement" && (
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              )}
              {(isDraft || isPending) && (
                <Button variant="outline" size="sm" onClick={() => setActivateOpen(true)}>
                  <Power className="h-4 w-4" /> Activate
                </Button>
              )}
              {isPending && (
                <Button variant="outline" size="sm" onClick={() => setSignOpen(true)}>
                  <FileSignature className="h-4 w-4" /> Mark as signed
                </Button>
              )}
              {isActive && (
                <Button variant="outline" size="sm" onClick={() => setTerminateOpen(true)}>
                  <XCircle className="h-4 w-4" /> Terminate
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={duplicating}>
                {duplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CopyIcon className="h-4 w-4" />} Duplicate
              </Button>
              {isDraft && (
                <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
            </div>
          )}
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
        {contract.contract_type === "lease" && lease ? (
          <LeaseSummaryCards
            leaseId={lease.id}
            annualRent={Number(lease.annual_rent)}
            currency={contract.currency}
            tenant={leaseTenant}
          />
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {contract.contract_type === "lease" && lease && (
            <TabsTrigger value="cheques">Cheques</TabsTrigger>
          )}
          {contract.contract_type === "lease" && lease && (
            <TabsTrigger value="tickets">Tickets ({ticketCount})</TabsTrigger>
          )}
          <TabsTrigger value="parties">Parties ({parties.length})</TabsTrigger>
          <TabsTrigger value="subjects">Subjects ({subjects.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {contract.contract_type !== "lease" && (
            <TabsTrigger value="tickets">Tickets ({ticketCount})</TabsTrigger>
          )}
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {contract.contract_type === "lease" && lease ? (
            <>
              <LeaseOverviewBlocks
                lease={lease as any}
                currency={contract.currency}
                tenant={leaseTenant}
                unit={leaseUnit}
                editable={canEdit && !isImmutable}
                onSaveEjariNumber={saveEjariNumber}
                onUploadEjariDoc={() => setActiveTab("documents")}
              />
              <Section title="Terms">
                <DL>
                  <DLRow label="Start" value={contract.start_date ? format(new Date(contract.start_date), "PPP") : "—"} />
                  <DLRow label="End" value={contract.end_date ? format(new Date(contract.end_date), "PPP") : "—"} />
                  <DLRow
                    label="Auto-renew"
                    value={
                      canEdit ? (
                        <Switch checked={contract.auto_renew} onCheckedChange={handleAutoRenewToggle} disabled={isImmutable || isTerminated} />
                      ) : (contract.auto_renew ? "Yes" : "No")
                    }
                  />
                  <DLRow
                    label="External reference"
                    value={
                      editingExtRef && canEdit ? (
                        <div className="flex items-center gap-1.5">
                          <Input value={extRefDraft} onChange={(e) => setExtRefDraft(e.target.value)} className="h-8 w-48" />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveExtRef}><Check className="h-3.5 w-3.5 text-status-occupied" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingExtRef(false)}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      ) : (
                        <button
                          className={canEdit && !isImmutable ? "hover:text-gold-deep inline-flex items-center gap-1.5" : ""}
                          onClick={() => {
                            if (!canEdit || isImmutable) return;
                            setExtRefDraft(contract.external_reference ?? "");
                            setEditingExtRef(true);
                          }}
                        >
                          {contract.external_reference || "—"}
                          {canEdit && !isImmutable && <Pencil className="h-3 w-3 opacity-50" />}
                        </button>
                      )
                    }
                  />
                </DL>
              </Section>
            </>
          ) : ma ? (
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
                <p className="text-[11px] text-muted-foreground mt-3">
                  Fee model and value are managed via the Edit wizard.
                </p>
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
                  <DLRow
                    label="Auto-renew"
                    value={
                      canEdit ? (
                        <Switch checked={contract.auto_renew} onCheckedChange={handleAutoRenewToggle} disabled={isImmutable || isTerminated} />
                      ) : (contract.auto_renew ? "Yes" : "No")
                    }
                  />
                  <DLRow
                    label="Termination notice"
                    value={
                      editingNoticeDays && canEdit ? (
                        <div className="flex items-center gap-1.5">
                          <Input type="number" min={0} value={noticeDaysDraft}
                            onChange={(e) => setNoticeDaysDraft(e.target.value)}
                            className="h-8 w-24" />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveNoticeDays}><Check className="h-3.5 w-3.5 text-status-occupied" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingNoticeDays(false)}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      ) : (
                        <button
                          className={canEdit && !isImmutable ? "hover:text-gold-deep inline-flex items-center gap-1.5" : ""}
                          onClick={() => {
                            if (!canEdit || isImmutable) return;
                            setNoticeDaysDraft(String(ma.termination_notice_days ?? 0));
                            setEditingNoticeDays(true);
                          }}
                        >
                          {ma.termination_notice_days != null ? `${ma.termination_notice_days} days` : "—"}
                          {canEdit && !isImmutable && <Pencil className="h-3 w-3 opacity-50" />}
                        </button>
                      )
                    }
                  />
                  <DLRow
                    label="External reference"
                    value={
                      editingExtRef && canEdit ? (
                        <div className="flex items-center gap-1.5">
                          <Input value={extRefDraft} onChange={(e) => setExtRefDraft(e.target.value)} className="h-8 w-48" />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveExtRef}><Check className="h-3.5 w-3.5 text-status-occupied" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingExtRef(false)}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      ) : (
                        <button
                          className={canEdit && !isImmutable ? "hover:text-gold-deep inline-flex items-center gap-1.5" : ""}
                          onClick={() => {
                            if (!canEdit || isImmutable) return;
                            setExtRefDraft(contract.external_reference ?? "");
                            setEditingExtRef(true);
                          }}
                        >
                          {contract.external_reference || "—"}
                          {canEdit && !isImmutable && <Pencil className="h-3 w-3 opacity-50" />}
                        </button>
                      )
                    }
                  />
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

          <Section title="Notes">
            {editingNotes && canEdit ? (
              <div className="space-y-2">
                <Textarea rows={4} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} />
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}><X className="h-3.5 w-3.5" /> Cancel</Button>
                  <Button size="sm" variant="gold" onClick={saveNotes}><Check className="h-3.5 w-3.5" /> Save</Button>
                </div>
              </div>
            ) : (
              <button
                className={"w-full text-left " + (canEdit && !isImmutable ? "hover:bg-muted/30 -m-2 p-2 rounded-sm" : "")}
                onClick={() => {
                  if (!canEdit || isImmutable) return;
                  setNotesDraft(contract.notes ?? "");
                  setEditingNotes(true);
                }}
              >
                {contract.notes ? (
                  <p className="text-sm text-architect whitespace-pre-wrap">{contract.notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {canEdit && !isImmutable ? "Click to add notes…" : "No notes."}
                  </p>
                )}
              </button>
            )}
          </Section>
        </TabsContent>

        {contract.contract_type === "lease" && lease && (
          <TabsContent value="cheques" className="mt-6">
            <ChequesTab
              leaseId={lease.id}
              contractId={contract.id}
              currency={contract.currency}
              canEdit={canEdit && !isImmutable}
            />
          </TabsContent>
        )}

        <TabsContent value="parties" className="mt-6 space-y-3">
          {isActive && canEdit && (
            <div className="border hairline rounded-sm bg-amber-500/10 border-amber-500/30 p-3 flex gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 leading-relaxed">
                This contract is active. Party changes should reflect real legal changes (e.g. transfer of ownership). Add a note explaining the reason.
              </p>
            </div>
          )}
          {canEdit && !isImmutable && (
            <div className="flex items-center justify-end">
              <Button size="sm" variant="gold" onClick={() => setAddPartyOpen(true)}>
                <Plus className="h-4 w-4" /> Add party
              </Button>
            </div>
          )}
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
                    {canEdit && !isImmutable && <th className="w-16" />}
                  </tr>
                </thead>
                <tbody>
                  {parties.map((p) => {
                    const isSelf = !!selfPersonId && p.person_id === selfPersonId;
                    const onlyParty = parties.length <= 1;
                    const cantRemove = isSelf || onlyParty;
                    return (
                      <tr key={p.id} className="border-b hairline last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Link to={`/people/${p.person_id}`} className="text-architect hover:text-gold-deep inline-flex items-center gap-1">
                            {partyName(p)} <ExternalLink className="h-3 w-3 opacity-50" />
                            {isSelf && <span className="ml-1.5 text-[10px] mono uppercase text-gold-deep">PM</span>}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {canEdit && !isImmutable && !isSelf ? (
                            <Select value={p.role} onValueChange={(v) => updatePartyRole(p.id, v)}>
                              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(() => {
                                  const allowed = getAllowedPartyRoles(contract.contract_type);
                                  // Always include the current role even if not in the allowed list
                                  // (legacy data) so the Select can render its current value.
                                  const list = allowed.includes(p.role as any)
                                    ? allowed
                                    : [p.role as any, ...allowed];
                                  return list.map((r) => (
                                    <SelectItem key={r} value={r}>{formatEnumLabel(r)}</SelectItem>
                                  ));
                                })()}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="capitalize">{p.role.replace(/_/g, " ")}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{p.is_signatory ? "Yes" : "No"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {p.signed_at ? format(new Date(p.signed_at), "PPP") : "—"}
                        </td>
                        {canEdit && !isImmutable && (
                          <td className="px-2 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={cantRemove}
                              title={cantRemove ? (isSelf ? "PM company must remain" : "At least one party required") : "Remove"}
                              onClick={() => setRemovePartyTarget(p)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="subjects" className="mt-6 space-y-3">
          {canEdit && !isImmutable && (
            <div className="flex items-center justify-end">
              <Button size="sm" variant="gold" onClick={() => setAddSubjectOpen(true)}>
                <Plus className="h-4 w-4" /> Add subject
              </Button>
            </div>
          )}
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
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                    <Icon className="h-4 w-4 text-true-taupe" strokeWidth={1.5} />
                    <Link to={href} className="flex-1 min-w-0">
                      <div className="text-sm text-architect truncate">{s.entity_label}</div>
                      <div className="text-[11px] text-muted-foreground capitalize">{s.entity_type}</div>
                    </Link>
                    <Link to={href}><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></Link>
                    {canEdit && !isImmutable && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Remove from contract"
                        onClick={() => setRemoveSubjectTarget(s)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <DocumentList entityType="contract" entityId={contract.id} editable={canEdit && !isImmutable} />
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <NotesPanel entityType="contract" entityId={contract.id} />
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
                      {e.actor_id ? "" : "System · "}
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ============== Dialogs ============== */}
      {contract.contract_type === "management_agreement" && (
        <ManagementAgreementWizard
          open={editOpen}
          onOpenChange={setEditOpen}
          editContractId={contract.id}
          onSaved={reloadAll}
        />
      )}

      {/* Lease edit mode wizard will be wired in a follow-up pass. */}

      <ActivateContractDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        contractId={contract.id}
        currentStatus={contract.status}
        subjectsCount={subjects.length}
        onActivated={reloadAll}
      />

      <MarkSignedDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        contractId={contract.id}
        parties={parties.map((p) => ({
          id: p.id,
          person_id: p.person_id,
          role: p.role,
          is_signatory: p.is_signatory,
          signed_at: p.signed_at,
          display_name: partyName(p),
        }))}
        onSaved={onSignaturesSaved}
      />

      <TerminateContractDialog
        open={terminateOpen}
        onOpenChange={setTerminateOpen}
        contractId={contract.id}
        startDate={contract.start_date}
        subjectsCount={subjects.length}
        existingNotes={contract.notes}
        onTerminated={reloadAll}
      />

      <DeleteContractDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        contractId={contract.id}
        contractNumber={contract.contract_number}
      />

      <AddPartyDialog
        open={addPartyOpen}
        onOpenChange={setAddPartyOpen}
        contractId={contract.id}
        contractType={contract.contract_type}
        excludePersonIds={existingPartyPersonIds}
        onAdded={reloadAll}
      />

      <AddSubjectDialog
        open={addSubjectOpen}
        onOpenChange={setAddSubjectOpen}
        contractId={contract.id}
        existingKeys={existingSubjectKeys}
        onAdded={reloadAll}
      />

      {/* Confirm: activate after sign */}
      <AlertDialog open={postSignActivateOpen} onOpenChange={setPostSignActivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>All parties have signed</AlertDialogTitle>
            <AlertDialogDescription>Activate the contract now?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction onClick={activateAfterSign} className="bg-status-occupied text-chalk hover:bg-status-occupied/90">
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: auto-renew change on active contract */}
      <AlertDialog open={confirmAutoRenewOpen} onOpenChange={setConfirmAutoRenewOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change auto-renew on an active contract?</AlertDialogTitle>
            <AlertDialogDescription>
              This contract is active. Toggling auto-renew affects how it expires and will be logged in history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingAutoRenew(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingAutoRenew !== null && doAutoRenewSave(pendingAutoRenew)}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove party confirm */}
      <AlertDialog open={!!removePartyTarget} onOpenChange={(v) => !v && setRemovePartyTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removePartyTarget ? partyName(removePartyTarget) : ""} from this contract?</AlertDialogTitle>
            <AlertDialogDescription>This will be logged in the contract history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeParty} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove subject confirm */}
      <AlertDialog open={!!removeSubjectTarget} onOpenChange={(v) => !v && setRemoveSubjectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeSubjectTarget?.entity_label} from this contract?</AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? "This contract is active. Removing this property may affect your authority to manage related leases."
                : "This will be logged in the contract history."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeSubject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
