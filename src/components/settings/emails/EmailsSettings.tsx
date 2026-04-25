import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmailBrandForm } from "./EmailBrandForm";
import { EmailTemplatesList } from "./EmailTemplatesList";
import { EmailSendLog } from "./EmailSendLog";

export function EmailsSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Emails</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage how Post Build sends emails on your behalf — global brand, templates per category, attachments, and the audit log.
        </p>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="brand">Brand</TabsTrigger>
          <TabsTrigger value="log">Send log</TabsTrigger>
        </TabsList>
        <TabsContent value="templates" className="mt-6">
          <EmailTemplatesList />
        </TabsContent>
        <TabsContent value="brand" className="mt-6">
          <EmailBrandForm />
        </TabsContent>
        <TabsContent value="log" className="mt-6">
          <EmailSendLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}