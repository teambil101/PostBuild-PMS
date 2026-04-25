import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Persona = "owner" | "broker" | "internal";

const PERSONAS: { value: Persona; label: string; sub: string }[] = [
  { value: "owner", label: "Property Owner", sub: "1–30 properties · free" },
  { value: "broker", label: "Broker / PM Co.", sub: "Run ops in your own workspace" },
  { value: "internal", label: "Operator (HQ)", sub: "Internal team workspace" },
];

export default function Auth() {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [persona, setPersona] = useState<Persona>("owner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    const { error } =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password, { workspace_kind: persona });
    setBusy(false);
    if (error) {
      toast.error(error);
    } else {
      if (mode === "signup") toast.success("Account created. Welcome to Post Build.");
      navigate("/");
    }
  };

  const fillTestAccount = (p: Persona) => {
    const stamp = Date.now().toString(36);
    setPersona(p);
    setEmail(`${p}+${stamp}@test.postbuild.local`);
    setPassword("test1234");
    setMode("signup");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left: brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-architect text-chalk p-12 relative overflow-hidden">
        <div>
          <div className="font-display text-3xl">Post Build</div>
          <div className="label-eyebrow text-chalk/60 mt-1">Property Operations</div>
        </div>
        <div className="space-y-6 max-w-md">
          <div className="h-px w-16 bg-gold" />
          <h1 className="font-display text-5xl leading-tight text-chalk">
            Buildings, units, and people — under one quiet, intelligent system.
          </h1>
          <p className="text-chalk/70 leading-relaxed">
            A studio-refined platform for property teams who care about how their software feels.
          </p>
        </div>
        <div className="mono text-[10px] uppercase tracking-widest text-chalk/40">
          v1.0 · Foundation
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden text-center">
            <div className="font-display text-3xl text-architect">Post Build</div>
            <div className="label-eyebrow mt-1">Property Operations</div>
          </div>

          <div className="space-y-2">
            <div className="label-eyebrow">{mode === "signin" ? "Welcome back" : "Get started"}</div>
            <h2 className="font-display text-3xl text-architect">
              {mode === "signin" ? "Sign in to your workspace" : "Create your workspace"}
            </h2>
          </div>

          {mode === "signup" && (
            <div className="space-y-2">
              <Label className="label-eyebrow">I am a…</Label>
              <div className="grid gap-2">
                {PERSONAS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPersona(p.value)}
                    className={`text-left border hairline p-3 transition-colors ${
                      persona === p.value
                        ? "border-architect bg-architect/5"
                        : "hover:border-architect/40"
                    }`}
                  >
                    <div className="text-sm font-medium text-architect">{p.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{p.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="label-eyebrow">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="label-eyebrow">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className="h-11"
              />
            </div>

            <Button type="submit" disabled={busy} className="w-full" size="lg">
              {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-xs text-muted-foreground hover:text-architect transition-colors"
            >
              {mode === "signin"
                ? "Don't have an account? Create one →"
                : "Already have an account? Sign in →"}
            </button>
          </div>

          <div className="border-t hairline pt-4 space-y-2">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground text-center">
              Quick test accounts
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {PERSONAS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => fillTestAccount(p.value)}
                  className="text-[10px] uppercase tracking-wider border hairline py-2 hover:border-architect hover:bg-architect/5 transition-colors text-architect"
                >
                  {p.value}
                </button>
              ))}
            </div>
            <div className="mono text-[9px] text-muted-foreground/70 text-center">
              Fills a fresh email · password test1234
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
