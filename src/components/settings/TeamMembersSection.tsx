import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, UserPlus, Search, Mail, Phone, X } from "lucide-react";
import { PersonFormDialog } from "@/components/people/PersonFormDialog";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface StaffPerson {
  id: string;
  ref_code: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  roles: string[];
  is_active: boolean;
  is_self: boolean;
}

/**
 * Lists every person in the directory tagged with the `staff` role.
 * Staff = anyone who can be assigned work inside the workspace
 * (lead owners, ticket assignees, etc.). Adding/removing here just
 * toggles the `staff` chip on the underlying People record.
 */
export function TeamMembersSection() {
  const { canEdit } = useAuth();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffPerson[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<StaffPerson | null>(null);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("people")
      .select("id, ref_code, first_name, last_name, email, phone, company, roles, is_active, is_self")
      .overlaps("roles", ["staff"])
      .order("first_name");
    if (error) toast.error(error.message);
    setStaff((data ?? []) as StaffPerson[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const removeFromTeam = async (p: StaffPerson) => {
    if (!confirm(`Remove ${p.first_name} ${p.last_name} from the team? They'll stay in your People directory but won't be assignable to leads or tickets.`)) {
      return;
    }
    const nextRoles = (p.roles ?? []).filter((r) => r !== "staff");
    const { error } = await supabase
      .from("people")
      .update({ roles: nextRoles })
      .eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed from team.");
    load();
  };

  const filtered = staff.filter((p) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q) ||
      (p.company ?? "").toLowerCase().includes(q) ||
      p.ref_code.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-architect">Team Members</h2>
        <p className="text-sm text-muted-foreground mt-1">
          People who can own leads, be assigned tickets, or appear as your company's staff. Anyone here is searchable in assignee pickers across the app.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search team…"
            className="pl-8 h-9"
          />
        </div>
        {canEdit && (
          <Button variant="gold" size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Add team member
          </Button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border hairline rounded-sm py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {query.trim() ? "No team members match your search." : "No team members yet."}
          </p>
          {canEdit && !query.trim() && (
            <Button variant="link" onClick={() => setAdding(true)} className="mt-2 text-gold-deep">
              Add your first team member
            </Button>
          )}
        </div>
      ) : (
        <div className="border hairline rounded-sm divide-y divide-border">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/people/${p.id}`}
                    className="font-medium text-architect hover:text-gold-deep truncate"
                  >
                    {p.first_name} {p.last_name}
                  </Link>
                  {p.is_self && (
                    <span className="text-[10px] uppercase tracking-wider text-gold-deep border border-gold/40 bg-gold/5 px-1.5 py-0.5 rounded-sm">
                      Company
                    </span>
                  )}
                  {!p.is_active && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border px-1.5 py-0.5 rounded-sm">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span className="mono">{p.ref_code}</span>
                  {p.email && (
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3" />
                      {p.email}
                    </span>
                  )}
                  {p.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {p.phone}
                    </span>
                  )}
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                  {!p.is_self && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromTeam(p)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Remove from team"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add: opens PersonFormDialog with staff role pre-selected */}
      {adding && (
        <PersonFormDialog
          open={adding}
          onOpenChange={setAdding}
          onSaved={() => {
            setAdding(false);
            load();
          }}
          initial={{ roles: ["staff"] }}
        />
      )}

      {/* Edit */}
      {editing && (
        <PersonFormDialog
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          initial={editing}
        />
      )}
    </div>
  );
}
