import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Users as UsersIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { PersonFormDialog } from "@/components/people/PersonFormDialog";
import { PersonRoleBadge } from "@/components/people/PersonRoleBadge";
import { initials } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Person {
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

const ROLE_FILTERS = [
  { v: "all", l: "All" },
  { v: "tenant", l: "Tenants" },
  { v: "owner", l: "Owners" },
  { v: "prospect", l: "Prospects" },
  { v: "staff", l: "Staff" },
  { v: "vendor", l: "Vendors" },
];

export default function People() {
  const { canEdit } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [pp, oo] = await Promise.all([
      supabase
        .from("people")
        .select("id, ref_code, first_name, last_name, email, phone, roles, company, city, is_active, avatar_url")
        .order("created_at", { ascending: false }),
      supabase.from("property_owners").select("person_id"),
    ]);
    if (pp.error) toast.error(pp.error.message);
    const ownsMap = new Map<string, number>();
    (oo.data ?? []).forEach((r: any) => {
      ownsMap.set(r.person_id, (ownsMap.get(r.person_id) ?? 0) + 1);
    });
    const merged = ((pp.data ?? []) as Person[]).map((p) => ({
      ...p,
      owns_count: ownsMap.get(p.id) ?? 0,
    }));
    setPeople(merged);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return people.filter((p) => {
      if (roleFilter !== "all" && !p.roles?.includes(roleFilter)) return false;
      if (!q) return true;
      const blob = `${p.first_name} ${p.last_name} ${p.email ?? ""} ${p.company ?? ""} ${p.ref_code}`.toLowerCase();
      return blob.includes(q);
    });
  }, [people, search, roleFilter]);

  return (
    <>
      <PageHeader
        eyebrow="Module · 03"
        title="People"
        description="A unified directory of everyone in your operation."
        actions={
          canEdit ? (
            <Button variant="gold" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New person
            </Button>
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
                  <Button variant="gold" onClick={() => setOpen(true)}>
                    <Plus className="h-4 w-4" /> Add a person
                  </Button>
                )
              }
            />
          ) : (
            <div className="border hairline rounded-sm divide-y divide-warm-stone/60 bg-card">
              {filtered.map((p) => (
                <Link
                  key={p.id}
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
              ))}
            </div>
          )}

      <PersonFormDialog
        open={open}
        onOpenChange={setOpen}
        onSaved={() => { setOpen(false); load(); }}
      />
    </>
  );
}
