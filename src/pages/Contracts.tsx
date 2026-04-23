import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FileText, Filter } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { ContractStatusBadge } from "@/components/contracts/ContractStatusBadge";
import { NewContractTypePicker } from "@/components/contracts/NewContractTypePicker";
import { CONTRACT_TYPE_LABEL, type ContractStatus, type ContractType } from "@/lib/contracts";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  contract_number: string;
  contract_type: ContractType;
  status: ContractStatus;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  parties: { person_id: string; role: string; person: { first_name: string; last_name: string; company: string | null } | null }[];
  subjects_count: number;
}

const FILTERS: { key: string; label: string; match: (r: Row) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "ma", label: "Management Agreements", match: (r) => r.contract_type === "management_agreement" },
  { key: "lease", label: "Leases", match: (r) => r.contract_type === "lease" },
  { key: "active", label: "Active", match: (r) => r.status === "active" },
  { key: "draft", label: "Draft", match: (r) => r.status === "draft" || r.status === "pending_signature" },
  {
    key: "expiring",
    label: "Expiring soon",
    match: (r) => {
      if (!r.end_date || r.status !== "active") return false;
      const days = (new Date(r.end_date).getTime() - Date.now()) / 86400000;
      return days <= 60 && days >= 0;
    },
  },
];

export default function Contracts() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          id, contract_number, contract_type, status, title, start_date, end_date,
          parties:contract_parties(person_id, role, person:people(first_name, last_name, company)),
          subjects:contract_subjects(id)
        `)
        .order("created_at", { ascending: false });
      if (!error && data) {
        setRows(
          data.map((r: any) => ({
            ...r,
            subjects_count: (r.subjects ?? []).length,
          })),
        );
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!f.match(r)) return false;
      if (!q) return true;
      const partiesText = r.parties
        .map((p) => `${p.person?.first_name ?? ""} ${p.person?.last_name ?? ""} ${p.person?.company ?? ""}`)
        .join(" ")
        .toLowerCase();
      return (
        r.contract_number.toLowerCase().includes(q) ||
        (r.title ?? "").toLowerCase().includes(q) ||
        partiesText.includes(q)
      );
    });
  }, [rows, filter, search]);

  return (
    <>
      <PageHeader
        eyebrow="Module"
        title="Contracts"
        description="Management agreements with landlords, leases with tenants, vendor service agreements. The rules that govern every job."
        actions={
          <Button onClick={() => setPickerOpen(true)}>
            <Plus className="h-4 w-4" />
            New contract
          </Button>
        }
      />

      <div className="mb-6 flex flex-col md:flex-row md:items-center gap-3 justify-between">
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
        <Input
          placeholder="Search number, title, party…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-72"
        />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">Loading contracts…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" strokeWidth={1.2} />}
          title={rows.length === 0 ? "No contracts yet" : "Nothing matches that filter"}
          description={
            rows.length === 0
              ? "Draft your first management agreement to start governing services and properties."
              : "Try a different filter or clear the search."
          }
          action={
            rows.length === 0 ? (
              <Button onClick={() => setPickerOpen(true)}>
                <Plus className="h-4 w-4" />
                New contract
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="border hairline rounded-sm bg-card overflow-hidden">
          <div className="table-scroll">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-muted/40 border-b hairline">
              <tr className="text-left">
                <th className="px-4 py-3 mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Number</th>
                <th className="px-4 py-3 mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Type</th>
                <th className="px-4 py-3 mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Parties</th>
                <th className="px-4 py-3 mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Properties</th>
                <th className="px-4 py-3 mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Period</th>
                <th className="px-4 py-3 mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const partyLabels = r.parties
                  .filter((p) => p.role !== "pm_company")
                  .map((p) =>
                    p.person?.company ||
                    `${p.person?.first_name ?? ""} ${p.person?.last_name ?? ""}`.trim() ||
                    "Unknown",
                  );
                return (
                  <tr key={r.id} className="border-b hairline last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/contracts/${r.id}`} className="mono text-xs text-architect hover:text-gold">
                        {r.contract_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-architect">
                      <Link to={`/contracts/${r.id}`} className="hover:text-gold">
                        <div>{r.title || CONTRACT_TYPE_LABEL[r.contract_type]}</div>
                        <div className="text-[11px] text-muted-foreground">{CONTRACT_TYPE_LABEL[r.contract_type]}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-architect text-xs">
                      {partyLabels.length > 0 ? partyLabels.join(", ") : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-architect text-xs">
                      {r.subjects_count} {r.subjects_count === 1 ? "property" : "properties"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.start_date ? new Date(r.start_date).toLocaleDateString() : "—"}
                      {r.end_date ? ` → ${new Date(r.end_date).toLocaleDateString()}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <ContractStatusBadge status={r.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <NewContractTypePicker open={pickerOpen} onOpenChange={setPickerOpen} />
    </>
  );
}