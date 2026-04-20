import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { CompanyProfileGate } from "@/components/contracts/CompanyProfileGate";
import { ContractTypePickerDialog } from "@/components/contracts/ContractTypePickerDialog";
import { ManagementAgreementWizard } from "@/components/contracts/ManagementAgreementWizard";
import { GenericContractDialog } from "@/components/contracts/GenericContractDialog";
import { ContractStatusPill } from "@/components/contracts/StatusPill";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CONTRACT_STATUSES, CONTRACT_STATUS_LABELS, type ContractStatus,
  CONTRACT_TYPES, CONTRACT_TYPE_LABELS, type ContractType,
  formatContractValue, summarizePeriod,
} from "@/lib/contracts";

interface ContractRow {
  id: string;
  contract_type: ContractType;
  contract_number: string;
  title: string;
  status: ContractStatus;
  start_date: string | null;
  end_date: string | null;
  currency: string;
  total_value: number | null;
  external_reference: string | null;
  parties_count?: number;
  parties_preview?: string;
  subjects_count?: number;
  fee_summary?: string | null;
}

export default function Contracts() {
  return (
    <CompanyProfileGate>
      <ContractsListInner />
    </CompanyProfileGate>
  );
}

function ContractsListInner() {
  const { canEdit } = useAuth();
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | ContractStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | ContractType>("all");
  const [search, setSearch] = useState("");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [maOpen, setMaOpen] = useState(false);
  const [genericOpen, setGenericOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: contracts } = await supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false });
    const list = (contracts ?? []) as ContractRow[];

    if (list.length > 0) {
      const ids = list.map((c) => c.id);
      const [partiesRes, subjectsRes, maRes] = await Promise.all([
        supabase
          .from("contract_parties")
          .select("contract_id, person_id, people(first_name, last_name, company)")
          .in("contract_id", ids),
        supabase.from("contract_subjects").select("contract_id, entity_type").in("contract_id", ids),
        supabase
          .from("management_agreements")
          .select("contract_id, fee_model, fee_value, fee_applies_to")
          .in("contract_id", ids),
      ]);

      const partyMap = new Map<string, string[]>();
      ((partiesRes.data ?? []) as any[]).forEach((p) => {
        const arr = partyMap.get(p.contract_id) ?? [];
        const name = p.people?.company || `${p.people?.first_name ?? ""} ${p.people?.last_name ?? ""}`.trim();
        if (name) arr.push(name);
        partyMap.set(p.contract_id, arr);
      });

      const subjMap = new Map<string, number>();
      ((subjectsRes.data ?? []) as any[]).forEach((s) => {
        subjMap.set(s.contract_id, (subjMap.get(s.contract_id) ?? 0) + 1);
      });

      const feeMap = new Map<string, string>();
      ((maRes.data ?? []) as any[]).forEach((m) => {
        feeMap.set(m.contract_id, formatContractValue(m.fee_model, m.fee_value, m.fee_applies_to));
      });

      list.forEach((c) => {
        const parties = partyMap.get(c.id) ?? [];
        c.parties_count = parties.length;
        c.parties_preview = parties.slice(0, 2).join(" ↔ ") + (parties.length > 2 ? ` +${parties.length - 2}` : "");
        c.subjects_count = subjMap.get(c.id) ?? 0;
        c.fee_summary = feeMap.get(c.id) ?? null;
      });
    }

    setRows(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Lifecycle stopgap: throttle to once per 6h
    const KEY = "lov_contract_lifecycle_last_run";
    const last = parseInt(localStorage.getItem(KEY) ?? "0", 10);
    if (Date.now() - last > 6 * 60 * 60 * 1000) {
      localStorage.setItem(KEY, String(Date.now()));
      supabase.rpc("process_contract_lifecycle").then(() => load());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.contract_type !== typeFilter) return false;
      if (q) {
        const hay = `${r.contract_number} ${r.title} ${r.external_reference ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, typeFilter, search]);

  const handleSelectType = (t: ContractType) => {
    setPickerOpen(false);
    if (t === "management_agreement") setMaOpen(true);
    else if (t === "other") setGenericOpen(true);
  };

  return (
    <>
      <PageHeader
        eyebrow="Module"
        title="Contracts"
        description="Management agreements, leases, and every other contractual relationship in one place."
        actions={
          canEdit && (
            <Button variant="gold" onClick={() => setPickerOpen(true)}>
              <Plus className="h-4 w-4" /> New contract
            </Button>
          )
        }
      />

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search contract #, title, reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {CONTRACT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{CONTRACT_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
          <SelectTrigger className="w-full md:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {CONTRACT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{CONTRACT_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted/40 animate-pulse rounded-sm" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" strokeWidth={1.2} />}
          title="No contracts yet"
          description="Create your first contract to start managing landlord relationships."
          action={
            canEdit && (
              <Button variant="gold" onClick={() => setPickerOpen(true)}>
                <Plus className="h-4 w-4" /> New contract
              </Button>
            )
          }
        />
      ) : filtered.length === 0 ? (
        <div className="border hairline rounded-sm bg-card p-8 text-center text-muted-foreground text-sm">
          No contracts match your filters.
        </div>
      ) : (
        <div className="border hairline rounded-sm bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b hairline text-left">
              <tr>
                <th className="px-4 py-3 label-eyebrow">Contract #</th>
                <th className="px-4 py-3 label-eyebrow">Type</th>
                <th className="px-4 py-3 label-eyebrow">Title</th>
                <th className="px-4 py-3 label-eyebrow">Parties</th>
                <th className="px-4 py-3 label-eyebrow">Subjects</th>
                <th className="px-4 py-3 label-eyebrow">Status</th>
                <th className="px-4 py-3 label-eyebrow">Period</th>
                <th className="px-4 py-3 label-eyebrow">Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b hairline last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 mono text-xs">
                    <Link to={`/contracts/${c.id}`} className="text-architect hover:text-gold-deep">
                      {c.contract_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{CONTRACT_TYPE_LABELS[c.contract_type]}</td>
                  <td className="px-4 py-3">
                    <Link to={`/contracts/${c.id}`} className="text-architect hover:text-gold-deep">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.parties_preview || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.subjects_count ? `${c.subjects_count}` : "—"}
                  </td>
                  <td className="px-4 py-3"><ContractStatusPill status={c.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {summarizePeriod(c.start_date, c.end_date)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{c.fee_summary ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ContractTypePickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onSelect={handleSelectType} />
      <ManagementAgreementWizard open={maOpen} onOpenChange={setMaOpen} />
      <GenericContractDialog open={genericOpen} onOpenChange={setGenericOpen} />
    </>
  );
}