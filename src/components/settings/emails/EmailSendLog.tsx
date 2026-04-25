import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Badge } from "@/components/ui/badge";
import { Loader2, Inbox } from "lucide-react";
import { format } from "date-fns";

export function EmailSendLog() {
  const { activeWorkspace } = useWorkspace();
  const { data, isLoading } = useQuery({
    enabled: !!activeWorkspace?.id,
    queryKey: ["email_send_log", activeWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("*")
        .eq("workspace_id", activeWorkspace!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-border rounded-sm">
        <Inbox className="h-8 w-8 mx-auto text-muted-foreground mb-3" strokeWidth={1.25} />
        <p className="text-sm text-muted-foreground">No emails sent yet.</p>
        <p className="text-xs text-muted-foreground mt-1">All outbound emails will appear here for audit.</p>
      </div>
    );
  }

  const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "sent") return "secondary";
    if (s === "failed") return "destructive";
    return "outline";
  };

  return (
    <div className="rounded-sm border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2 font-medium">When</th>
            <th className="text-left px-3 py-2 font-medium">Template</th>
            <th className="text-left px-3 py-2 font-medium">To</th>
            <th className="text-left px-3 py-2 font-medium">Subject</th>
            <th className="text-left px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(row.created_at), "dd MMM yyyy HH:mm")}
              </td>
              <td className="px-3 py-2 text-xs font-mono">{row.template_key || "—"}</td>
              <td className="px-3 py-2 text-xs">{row.to_email}</td>
              <td className="px-3 py-2 text-xs truncate max-w-[280px]">{row.subject}</td>
              <td className="px-3 py-2"><Badge variant={statusVariant(row.status)} className="text-[10px] uppercase">{row.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}