import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Link2, Link2Off, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PersonCombobox } from "@/components/owners/PersonCombobox";
import { useAuth } from "@/contexts/AuthContext";

interface AuthRow {
  auth_user_id: string;
  email: string;
  created_at: string;
  person_id: string | null;
  person_first_name: string | null;
  person_last_name: string | null;
  person_ref_code: string | null;
  person_roles: string[] | null;
}

/**
 * Admin tool: list every auth.users row and link each one to a `people` record
 * by setting `people.auth_user_id`. The link drives "current_user_person_id()"
 * and powers the My Work dashboard.
 *
 * Staff users see an empty list (RPC is admin-gated server-side); for them this
 * section just renders nothing.
 */
export function AuthLinksSection() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [rows, setRows] = useState<AuthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingFor, setLinkingFor] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_auth_users_with_person");
    if (error) toast.error(error.message);
    setRows((data ?? []) as AuthRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const linkPerson = async (authUserId: string, personId: string) => {
    // Clear any prior link to this auth user, then assign the new one.
    const { error: clearErr } = await supabase
      .from("people")
      .update({ auth_user_id: null })
      .eq("auth_user_id", authUserId);
    if (clearErr) {
      toast.error(clearErr.message);
      return;
    }
    const { error } = await supabase
      .from("people")
      .update({ auth_user_id: authUserId })
      .eq("id", personId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account linked.");
    setLinkingFor(null);
    load();
  };

  const unlink = async (personId: string) => {
    if (!confirm("Unlink this login from the person record? They'll lose access to the My Work dashboard until re-linked.")) {
      return;
    }
    const { error } = await supabase
      .from("people")
      .update({ auth_user_id: null })
      .eq("id", personId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Unlinked.");
    load();
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-3 border-t hairline pt-6">
      <div>
        <h3 className="font-display text-lg text-architect">Linked Logins</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Connect each sign-in account to its person record. The link powers the My Work dashboard
          (so we know which tickets and leads belong to "you").
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm italic text-muted-foreground py-4">No logins yet.</p>
      ) : (
        <div className="border hairline rounded-sm divide-y divide-border">
          {rows.map((r) => {
            const personLabel = r.person_id
              ? `${r.person_first_name ?? ""} ${r.person_last_name ?? ""}`.trim() ||
                r.person_ref_code ||
                "Linked person"
              : null;
            const showPicker = linkingFor === r.auth_user_id;
            return (
              <div key={r.auth_user_id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-architect truncate">{r.email}</span>
                </div>

                <div className="flex-1 min-w-[260px]">
                  {showPicker ? (
                    <PersonCombobox
                      value=""
                      onChange={(p) => linkPerson(r.auth_user_id, p.id)}
                      placeholder="Pick a person to link…"
                    />
                  ) : r.person_id ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Link2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                      <span className="text-architect truncate">{personLabel}</span>
                      {r.person_ref_code && (
                        <span className="mono text-[10px] text-muted-foreground">
                          {r.person_ref_code}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm italic text-muted-foreground">Not linked</span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {r.person_id ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unlink(r.person_id!)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Link2Off className="h-3.5 w-3.5 mr-1" /> Unlink
                    </Button>
                  ) : showPicker ? (
                    <Button variant="ghost" size="sm" onClick={() => setLinkingFor(null)}>
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLinkingFor(r.auth_user_id)}
                    >
                      <Link2 className="h-3.5 w-3.5 mr-1" /> Link to person
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}