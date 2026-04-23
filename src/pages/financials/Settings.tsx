import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

type Account = {
  id: string;
  code: string;
  name: string;
  account_type: string;
  is_system: boolean;
  is_active: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  income: "Income",
  expense: "Expenses",
};

export function FinancialsSettings() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("accounts")
        .select("id, code, name, account_type, is_system, is_active")
        .order("code");
      setAccounts((data ?? []) as Account[]);
      setLoading(false);
    })();
  }, []);

  const grouped = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    (acc[a.account_type] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl text-architect mb-1">Chart of accounts</h2>
        <p className="text-sm text-muted-foreground">
          Standard accounts seeded for property-management bookkeeping. System accounts cannot be removed.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.entries(grouped).map(([type, items]) => (
            <Card key={type} className="p-5">
              <div className="label-eyebrow text-muted-foreground mb-3">{TYPE_LABEL[type] ?? type}</div>
              <ul className="space-y-1.5">
                {items.map((a) => (
                  <li key={a.id} className="flex items-baseline gap-3 text-sm">
                    <span className="mono text-xs text-muted-foreground tabular-nums w-12">{a.code}</span>
                    <span className="text-architect flex-1">{a.name}</span>
                    {a.is_system && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">system</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}