import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, Users as UsersIcon, Truck, Star, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { PersonFormDialog } from "@/components/people/PersonFormDialog";
import { PersonRoleBadge } from "@/components/people/PersonRoleBadge";
import { NewVendorDialog } from "@/components/vendors/NewVendorDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { vendorDisplayName, parseSpecialties, SPECIALTY_LABELS } from "@/lib/vendors";
import { initials } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PersonEntry {
  kind: "person";
  id: string;
  ref_code: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  roles: string[];
  company: string | null;
  city: string | null;
  is_active: boolean;
  avatar_url: string | null;
  owns_count?: number;
}

interface VendorEntry {
  kind: "vendor";
  id: string;
  ref_code: string;          // vendor_number
  name: string;              // display_name || legal_name
  legal_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;       // derived from address (best-effort: null)
  is_active: boolean;        // status === 'active'
  is_preferred: boolean;
  status: string;
  specialties: unknown;
}

type DirectoryEntry = PersonEntry | VendorEntry;

const ROLE_FILTERS = [
  { v: "all", l: "All" },
  { v: "tenant", l: "Tenants" },
  { v: "owner", l: "Owners" },
  { v: "prospect", l: "Prospects" },
  { v: "staff", l: "Staff" },
  { v: "vendor", l: "Vendors" }, // includes vendor companies + people tagged as vendor
];

export default function People() {
  const { canEdit } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [people, setPeople] = useState<PersonEntry[]>([]);
  const [vendors, setVendors] = useState<VendorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const roleFilter = searchParams.get("role") ?? "all";
  const setRoleFilter = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === "all") next.delete("role");
    else next.set("role", v);
    setSearchParams(next, { replace: true });
  };
  const [personOpen, setPersonOpen] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [pp, oo, vv] = await Promise.all([
      supabase
        .from("people")
        .select("id, ref_code, first_name, last_name, email, phone, roles, company, city, is_active, avatar_url")
        .order("created_at", { ascending: false }),
      supabase.from("property_owners").select("person_id"),
      supabase
        .from("vendors")
        .select("id, vendor_number, legal_name, display_name, primary_email, primary_phone, address, status, is_preferred, specialties")
        .order("is_preferred", { ascending: false })
        .order("legal_name", { ascending: true }),
    ]);
    if (pp.error) toast.error(pp.error.message);
    if (vv.error) toast.error(vv.error.message);
    const ownsMap = new Map<string, number>();
    (oo.data ?? []).forEach((r: any) => {
      ownsMap.set(r.person_id, (ownsMap.get(r.person_id) ?? 0) + 1);
    });
    const mergedPeople: PersonEntry[] = ((pp.data ?? []) as any[]).map((p) => ({
      kind: "person",
      ...p,
      owns_count: ownsMap.get(p.id) ?? 0,
    }));
    const mergedVendors: VendorEntry[] = ((vv.data ?? []) as any[]).map((v) => ({
      kind: "vendor",
      id: v.id,
      ref_code: v.vendor_number,
      name: (v.display_name && v.display_name.trim()) || v.legal_name,
      legal_name: v.legal_name,
      email: v.primary_email,
      phone: v.primary_phone,
      city: null,
      is_active: v.status === "active",
      is_preferred: !!v.is_preferred,
      status: v.status,
      specialties: v.specialties,
    }));
    setPeople(mergedPeople);
    setVendors(mergedVendors);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo<DirectoryEntry[]>(() => {
    const q = search.toLowerCase().trim();

    const matchPerson = (p: PersonEntry) => {
      if (roleFilter !== "all" && roleFilter !== "vendor" && !p.roles?.includes(roleFilter)) return false;
      if (roleFilter === "vendor" && !p.roles?.includes("vendor")) return false;
      if (!q) return true;
      const blob = `${p.first_name} ${p.last_name} ${p.email ?? ""} ${p.company ?? ""} ${p.ref_code}`.toLowerCase();
      return blob.includes(q);
    };

    const matchVendor = (v: VendorEntry) => {
      if (!q) return true;
      const blob = `${v.name} ${v.legal_name} ${v.email ?? ""} ${v.phone ?? ""} ${v.ref_code}`.toLowerCase();
      return blob.includes(q);
    };

    // Vendors only show in "All" and "Vendors" filter
    const showVendors = roleFilter === "all" || roleFilter === "vendor";
    const peopleFiltered = people.filter(matchPerson);
    const vendorsFiltered = showVendors ? vendors.filter(matchVendor) : [];

    // Sort: vendors with preferred star first, then people by created order (existing).
    return [...vendorsFiltered, ...peopleFiltered];
  }, [people, vendors, search, roleFilter]);

  return (
    <>
      <PageHeader
        eyebrow="Module · 03"
        title="Directory"
        description="A unified directory of everyone in your operation — people and vendor companies."
        actions={
          canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="gold">
                  <Plus className="h-4 w-4" /> New
                  <ChevronDown className="h-3.5 w-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setPersonOpen(true)}>
                  <UsersIcon className="h-4 w-4 mr-2" /> New person
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setVendorOpen(true)}>
                  <Truck className="h-4 w-4 mr-2" /> New vendor company
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search name, email, company…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-9"
              />
            </div>
            <div className="inline-flex border hairline rounded-sm p-0.5 bg-muted/40 overflow-x-auto">
              {ROLE_FILTERS.map((r) => (
                <button
                  key={r.v}
                  onClick={() => setRoleFilter(r.v)}
                  className={cn(
                    "px-3 py-1.5 text-[11px] uppercase tracking-wider rounded-sm transition-colors shrink-0",
                    roleFilter === r.v ? "bg-architect text-chalk" : "text-muted-foreground hover:text-architect",
                  )}
                >
                  {r.l}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 bg-muted/40 rounded-sm animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<UsersIcon className="h-10 w-10" strokeWidth={1.2} />}
              title={search || roleFilter !== "all" ? "No matches" : "No people yet"}
              description={
                search || roleFilter !== "all"
                  ? "Try a different filter."
                  : "Add the first person to your directory."
              }
              action={
                !search && roleFilter === "all" && canEdit && (
                  <Button variant="gold" onClick={() => setPersonOpen(true)}>
                    <Plus className="h-4 w-4" /> Add a person
                  </Button>
                )
              }
            />
          ) : (
            <div className="border hairline rounded-sm divide-y divide-warm-stone/60 bg-card">
              {filtered.map((entry) => entry.kind === "vendor"
                ? <VendorRow key={`v-${entry.id}`} entry={entry} />
                : <PersonRow key={`p-${entry.id}`} entry={entry} />
              )}
            </div>
          )}

      <PersonFormDialog
        open={personOpen}
        onOpenChange={setPersonOpen}
        onSaved={() => { setPersonOpen(false); load(); }}
      />
      <NewVendorDialog
        open={vendorOpen}
        onOpenChange={setVendorOpen}
        onSaved={() => { setVendorOpen(false); load(); }}
      />
    </>
  );
}

function PersonRow({ entry: p }: { entry: PersonEntry }) {
  return (
    <Link
      to={`/people/${p.id}`}
      className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
    >
      <div className="h-10 w-10 shrink-0 bg-architect text-chalk flex items-center justify-center rounded-sm text-sm font-medium">
        {initials(p.first_name, p.last_name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <div className="font-display text-lg text-architect truncate">
            {p.first_name} {p.last_name}
          </div>
          <span className="ref-code">{p.ref_code}</span>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {[p.email, p.company, p.city].filter(Boolean).join(" · ") || "—"}
        </div>
      </div>
      <div className="hidden md:flex items-center gap-1.5 flex-wrap shrink-0 max-w-[260px] justify-end">
        {p.roles?.map((r) => <PersonRoleBadge key={r} role={r as any} />)}
        {p.owns_count && p.owns_count > 0 ? (
          <span className="inline-block px-2 py-0.5 rounded-sm border border-gold/40 bg-gold/15 text-smoked-bronze text-[10px] uppercase tracking-wider font-medium">
            Owner ({p.owns_count})
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function VendorRow({ entry: v }: { entry: VendorEntry }) {
  const specs = parseSpecialties(v.specialties);
  const specSummary = specs.slice(0, 2).map((s) => SPECIALTY_LABELS[s]).join(" · ");
  const overflow = Math.max(0, specs.length - 2);
  return (
    <Link
      to={`/vendors/${v.id}`}
      className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
    >
      <div className="h-10 w-10 shrink-0 bg-smoked-bronze/15 text-smoked-bronze flex items-center justify-center rounded-sm">
        <Truck className="h-4 w-4" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <div className="font-display text-lg text-architect truncate inline-flex items-center gap-1.5">
            {v.is_preferred && <Star className="h-3.5 w-3.5 fill-gold text-gold" />}
            {v.name}
          </div>
          <span className="ref-code">{v.ref_code}</span>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {[specSummary + (overflow ? ` +${overflow}` : ""), v.email, v.phone].filter(Boolean).join(" · ") || "—"}
        </div>
      </div>
      <div className="hidden md:flex items-center gap-1.5 flex-wrap shrink-0 max-w-[260px] justify-end">
        <span className="inline-block px-2 py-0.5 rounded-sm border border-smoked-bronze/40 bg-smoked-bronze/10 text-smoked-bronze text-[10px] uppercase tracking-wider font-medium">
          Vendor company
        </span>
        {!v.is_active && (
          <span className="inline-block px-2 py-0.5 rounded-sm border border-warm-stone bg-warm-stone/30 text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
            {v.status}
          </span>
        )}
      </div>
    </Link>
  );
}
