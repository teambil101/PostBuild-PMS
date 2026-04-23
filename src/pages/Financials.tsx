import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Overview } from "./financials/Overview";
import { Receivables } from "./financials/Receivables";
import { Payables } from "./financials/Payables";
import { Payments } from "./financials/Payments";
import { OwnerStatements } from "./financials/OwnerStatements";
import { Reports } from "./financials/Reports";
import { FinancialsSettings } from "./financials/Settings";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "receivables", label: "Receivables" },
  { value: "payables", label: "Payables" },
  { value: "payments", label: "Payments" },
  { value: "statements", label: "Owner statements" },
  { value: "reports", label: "Reports" },
  { value: "settings", label: "Settings" },
] as const;

export default function Financials() {
  const [tab, setTab] = useState<string>("overview");

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Financials"
        description="Invoices, bills, payments, owner statements and reports."
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="h-auto p-0 bg-transparent border-b hairline rounded-none w-full justify-start gap-1 mb-6">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-0"><Overview /></TabsContent>
        <TabsContent value="receivables" className="mt-0"><Receivables /></TabsContent>
        <TabsContent value="payables" className="mt-0"><Payables /></TabsContent>
        <TabsContent value="payments" className="mt-0"><Payments /></TabsContent>
        <TabsContent value="statements" className="mt-0"><OwnerStatements /></TabsContent>
        <TabsContent value="reports" className="mt-0"><Reports /></TabsContent>
        <TabsContent value="settings" className="mt-0"><FinancialsSettings /></TabsContent>
      </Tabs>
    </>
  );
}