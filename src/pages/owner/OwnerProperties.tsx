import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

interface Building {
  id: string;
  name: string;
  address: string | null;
  city: string;
  country: string;
}

export default function OwnerProperties() {
  const { activeWorkspace } = useWorkspace();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", street: "", city: "" });

  const load = async () => {
    if (!activeWorkspace) return;
    const { data } = await supabase
      .from("buildings")
      .select("id, name, address, city, country")
      .eq("workspace_id", activeWorkspace.id)
      .order("created_at", { ascending: false });
    setBuildings(((data ?? []) as unknown) as Building[]);
  };

  useEffect(() => {
    void load();
  }, [activeWorkspace?.id]);

  const submit = async () => {
    if (!activeWorkspace) return;
    if (!form.name.trim() || !form.street.trim() || !form.city.trim()) {
      toast.error("Please fill all fields");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("owner_onboard_property", {
      _workspace_id: activeWorkspace.id,
      _name: form.name.trim(),
      _address_line1: form.street.trim(),
      _city: form.city.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Property added");
    setOpen(false);
    setForm({ name: "", street: "", city: "" });
    void load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portfolio"
        title="My Properties"
        description="Everything you own, in one place."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add property
          </Button>
        }
      />

      {buildings.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" strokeWidth={1.5} />}
          title="No properties yet"
          description="Add your first property to get started — just three quick fields."
          action={<Button onClick={() => setOpen(true)}>Add property</Button>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {buildings.map((b) => (
            <Link key={b.id} to={`/owner/properties/${b.id}`}>
              <Card className="p-5 hover:border-architect/40 transition-colors h-full">
                <Building2 className="h-5 w-5 text-architect/60 mb-3" strokeWidth={1.5} />
                <div className="font-display text-lg text-architect">{b.name}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {b.address ? `${b.address}, ` : ""}
                  {b.city}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a property</DialogTitle>
            <DialogDescription>Just the basics — you can fill in more later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="prop-name">Name or nickname</Label>
              <Input
                id="prop-name"
                placeholder="e.g. Marina Apartment"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prop-street">Street address</Label>
              <Input
                id="prop-street"
                placeholder="e.g. 12 Marina Walk"
                value={form.street}
                onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prop-city">City</Label>
              <Input
                id="prop-city"
                placeholder="e.g. Dubai"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Adding…" : "Add property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}