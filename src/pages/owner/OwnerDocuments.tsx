import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

interface Doc {
  id: string;
  filename: string | null;
  doc_type: string | null;
  created_at: string;
}

export default function OwnerDocuments() {
  const { activeWorkspace } = useWorkspace();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, filename, doc_type, created_at")
        .eq("workspace_id", activeWorkspace.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setDocs(((data ?? []) as unknown) as Doc[]);
      setLoading(false);
    })();
  }, [activeWorkspace?.id]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Files"
        title="Documents"
        description="Title deeds, contracts, statements — your important files in one place."
      />
      {loading ? null : docs.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" strokeWidth={1.5} />}
          title="No documents yet"
          description="Documents you receive or upload will appear here."
        />
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <Card key={d.id} className="p-4 flex items-center gap-3">
              <FileText className="h-4 w-4 text-architect/60" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-architect truncate">{d.filename ?? "Untitled"}</div>
                <div className="mono text-[10px] uppercase text-muted-foreground mt-0.5">
                  {d.doc_type ?? "Document"} · {new Date(d.created_at).toLocaleDateString()}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}