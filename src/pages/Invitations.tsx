import { useEffect, useState } from "react";
import { Mail, Plus, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export default function Invitations() {
  const { activeWorkspace } = useWorkspace();
  const [items, setItems] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    if (!activeWorkspace) return;
    const { data } = await supabase
      .from("workspace_invitations")
      .select("id, email, role, token, expires_at, accepted_at, created_at")
      .eq("workspace_id", activeWorkspace.id)
      .order("created_at", { ascending: false });
    setItems(((data ?? []) as unknown) as Invitation[]);
  };

  useEffect(() => {
    void load();
  }, [activeWorkspace?.id]);

  const create = async () => {
    if (!activeWorkspace || !email.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("workspace_invitations").insert({
      workspace_id: activeWorkspace.id,
      email: email.trim().toLowerCase(),
      role: role as "admin" | "manager" | "agent" | "viewer" | "owner",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Invitation created");
    setEmail("");
    void load();
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
    toast.success("Invite link copied");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Invitations"
        description="Invite owners, brokers, or teammates to this workspace. Copy the link and send it however you like."
      />

      <Card className="p-5">
        <div className="grid sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="owner@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={create} disabled={submitting || !email}>
            <Plus className="h-4 w-4 mr-2" /> Create invite
          </Button>
        </div>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          icon={<Mail className="h-8 w-8" strokeWidth={1.5} />}
          title="No invitations yet"
          description="Create one above to invite a teammate, broker, or owner."
        />
      ) : (
        <div className="space-y-2">
          {items.map((inv) => (
            <Card key={inv.id} className="p-4 flex items-center gap-3">
              <Mail className="h-4 w-4 text-architect/60" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-architect truncate">{inv.email}</div>
                <div className="mono text-[10px] uppercase text-muted-foreground mt-0.5">
                  {inv.role} ·{" "}
                  {inv.accepted_at
                    ? `Accepted ${new Date(inv.accepted_at).toLocaleDateString()}`
                    : `Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                </div>
              </div>
              {!inv.accepted_at && (
                <Button size="sm" variant="outline" onClick={() => copyLink(inv.token)}>
                  {copied === inv.token ? <Check className="h-3.5 w-3.5 mr-2" /> : <Copy className="h-3.5 w-3.5 mr-2" />}
                  Copy link
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}