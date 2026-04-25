import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface InvitationInfo {
  workspace_id: string;
  workspace_name: string;
  workspace_kind: "internal" | "owner" | "broker";
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
}

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, signIn, signUp } = useAuth();
  const { refresh, setActive } = useWorkspace();
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth form
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase.rpc("lookup_invitation", { _token: token });
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setError("This invitation is invalid or no longer exists.");
        setLoading(false);
        return;
      }
      const row = (Array.isArray(data) ? data[0] : data) as InvitationInfo;
      if (row.accepted_at) setError("This invitation has already been used.");
      else if (new Date(row.expires_at) < new Date()) setError("This invitation has expired.");
      setInfo(row);
      setLoading(false);
    })();
  }, [token]);

  const accept = async () => {
    if (!token) return;
    const { data, error } = await supabase.rpc("accept_workspace_invitation", { _token: token });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome aboard!");
    await refresh();
    if (data) setActive(data as string);
    navigate(info?.workspace_kind === "owner" ? "/owner" : "/dashboard");
  };

  const handleAuth = async () => {
    if (!info) return;
    setSubmitting(true);
    const fn = mode === "signup" ? signUp : signIn;
    const { error } = await fn(info.email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    // After auth, attempt to accept right away
    setTimeout(() => void accept(), 200);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" strokeWidth={1.5} />
          <h1 className="font-display text-2xl text-architect">Invitation unavailable</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Link to="/auth">
            <Button variant="outline">Go to sign in</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (!info) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="max-w-md w-full p-8 space-y-6">
        <div className="text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-gold mx-auto" strokeWidth={1.5} />
          <div className="label-eyebrow text-muted-foreground">You're invited</div>
          <h1 className="font-display text-2xl text-architect">{info.workspace_name}</h1>
          <p className="text-sm text-muted-foreground">
            Join as <span className="text-architect uppercase mono text-[11px]">{info.role}</span> ·{" "}
            <span className="text-architect">{info.email}</span>
          </p>
        </div>

        {user ? (
          user.email?.toLowerCase() === info.email.toLowerCase() ? (
            <Button className="w-full" onClick={accept}>
              Accept invitation
            </Button>
          ) : (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                You're signed in as <span className="text-architect">{user.email}</span>, but this invite is for{" "}
                <span className="text-architect">{info.email}</span>. Sign out and try again.
              </p>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{mode === "signup" ? "Create a password" : "Password"}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button className="w-full" onClick={handleAuth} disabled={submitting || password.length < 6}>
              {submitting ? "Working…" : mode === "signup" ? "Create account & join" : "Sign in & join"}
            </Button>
            <button
              className="w-full text-xs text-muted-foreground hover:text-architect"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Create one"}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}