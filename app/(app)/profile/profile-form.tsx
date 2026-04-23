"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateProfileAction } from "./actions";

type Team = { id: string; name: string };

export function ProfileForm({
  initial,
  teams,
}: {
  initial: { fullName: string; avatarUrl: string; teamId: string };
  teams: Team[];
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState(initial);
  const [newTeam, setNewTeam] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      const res = await updateProfileAction({
        fullName: state.fullName,
        avatarUrl: state.avatarUrl || null,
        teamId: state.teamId || null,
        newTeamName: newTeam || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Profile updated");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          value={state.fullName}
          onChange={(e) => setState({ ...state, fullName: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="avatarUrl">Avatar URL (optional)</Label>
        <Input
          id="avatarUrl"
          value={state.avatarUrl}
          onChange={(e) => setState({ ...state, avatarUrl: e.target.value })}
          placeholder="https://..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="teamId">Team</Label>
        <Select
          value={state.teamId}
          onValueChange={(v) => setState({ ...state, teamId: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a team" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="newTeam">Or create a new team</Label>
        <Input
          id="newTeam"
          value={newTeam}
          onChange={(e) => setNewTeam(e.target.value)}
          placeholder="New team name"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
