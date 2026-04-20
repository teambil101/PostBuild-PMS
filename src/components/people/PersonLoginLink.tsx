import { useEffect, useState } from "react";
import { Link2, Link2Off, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";

interface AuthRow {
  auth_user_id: string;
  email: string;
  person_id: string | null;
}

/**
 * Admin-only: shows the login account currently linked to this person, and
 * lets an admin link/unlink a login. Renders nothing for non-admin viewers.
 */
export function PersonLoginLink({
  personId,
  currentAuthUserId,
  onChanged,
}: {
  personId: string;
  currentAuthUserId: string | null;
  onChanged: () => void;
}) {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<AuthRow[]>([]);
  const [picking, setPicking] = useState(false);
  const [pickValue, setPickValue] = useState<string>("");

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("list_auth_users_with_person");
      if (error) toast.error(error.message);
      setRows((data ?? []) as AuthRow[]);
      setLoading(false);
    })();
  }, [isAdmin]);

  if (!isAdmin) return null;

  const linked = rows.find((r) => r.auth_user_id === currentAuthUserId) ?? null;
  // Logins available to assign: not yet linked to anyone.
  const available = rows.filter((r) => !r.person_id);

  const link = async (authUserId: string) => {
    setBusy(true);
    // Clear any prior link to that auth user, then assign it here.
    await supabase.from("people").update({ auth_user_id: null }).eq("auth_user_id", authUserId);
    const { error } = await supabase
      .from("people")
      .update({ auth_user_id: authUserId })
      .eq("id", personId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Login linked.");
    setPicking(false);
    setPickValue("");
    onChanged();
  };

  const unlink = async () => {
    if (!confirm("Unlink this login? They'll lose access to the My Work dashboard until re-linked.")) return;
    setBusy(true);
    const { error } = await supabase
      .from("people")
      .update({ auth_user_id: null })
      .eq("id", personId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Unlinked.");
    onChanged();
  };

  return (
    <div className="border hairline rounded-sm bg-card p-4 mb-10">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="label-eyebrow flex items-center gap-1.5">
            <Link2 className="h-3 w-3" /> Login account
          </div>
          <div className="mt-1.5 text-sm">
            {loading ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </span>
            ) : linked ? (
              <span className="inline-flex items-center gap-2 text-architect">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {linked.email}
              </span>
            ) : (
              <span className="italic text-muted-foreground">No login account linked.</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-md">
            The link powers the My Work dashboard so we know which tickets and leads belong to this person.
          </p>
        </div>

        {!loading && (
          <div className="flex items-center gap-2 shrink-0">
            {linked ? (
              <Button variant="ghost" size="sm" onClick={unlink} disabled={busy}
                className="text-muted-foreground hover:text-destructive">
                <Link2Off className="h-3.5 w-3.5 mr-1" /> Unlink
              </Button>
            ) : picking ? (
              <>
                <Select value={pickValue} onValueChange={setPickValue}>
                  <SelectTrigger className="h-9 min-w-[240px]">
                    <SelectValue placeholder={available.length ? "Pick a login…" : "No unlinked logins"} />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((r) => (
                      <SelectItem key={r.auth_user_id} value={r.auth_user_id}>{r.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="gold" size="sm" onClick={() => pickValue && link(pickValue)} disabled={!pickValue || busy}>
                  Link
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setPicking(false); setPickValue(""); }}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
                <Link2 className="h-3.5 w-3.5 mr-1" /> Link login
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}