"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTeamAction, deleteTeamAction } from "./actions";

export function TeamsClient({
  teams,
}: {
  teams: Array<{ id: string; name: string; memberCount: number }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    start(async () => {
      const res = await createTeamAction(n);
      if (!res.ok) {
        toast.error("error" in res ? String(res.error) : "Failed");
        return;
      }
      setName("");
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this team?")) return;
    start(async () => {
      const res = await deleteTeamAction(id);
      if (!res.ok) toast.error("error" in res ? String(res.error) : "Failed");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New team name"
        />
        <Button type="submit" size="sm" disabled={pending || !name.trim()}>
          <Plus className="h-4 w-4" /> Add team
        </Button>
      </form>
      <div className="divide-y rounded-md border bg-card">
        {teams.length === 0 && <div className="p-6 text-sm text-muted-foreground">No teams yet.</div>}
        {teams.map((t) => (
          <div key={t.id} className="flex items-center px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{t.name}</div>
              <div className="text-xs text-muted-foreground">
                {t.memberCount} member{t.memberCount === 1 ? "" : "s"}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove(t.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
