import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";

export default function OwnerAccount() {
  const { user, signOut } = useAuth();
  const { activeWorkspace } = useWorkspace();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="My Account" description="Your profile and workspace details." />
      <Card className="p-6 space-y-4">
        <div>
          <div className="label-eyebrow text-muted-foreground">Email</div>
          <div className="text-sm text-architect mt-1">{user?.email ?? "—"}</div>
        </div>
        <div>
          <div className="label-eyebrow text-muted-foreground">Workspace</div>
          <div className="text-sm text-architect mt-1">{activeWorkspace?.name ?? "—"}</div>
        </div>
        <div>
          <div className="label-eyebrow text-muted-foreground">Plan</div>
          <div className="text-sm text-architect mt-1 uppercase mono">{activeWorkspace?.plan ?? "free"}</div>
        </div>
        <div className="pt-4 border-t hairline">
          <Button variant="outline" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}