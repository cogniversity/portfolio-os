"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function WorkloadTeamFilter({
  teams,
  teamId,
}: {
  teams: Array<{ id: string; name: string }>;
  teamId?: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  function setParam(name: string, value: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "all") params.set(name, value);
    else params.delete(name);
    router.push(`${path}?${params.toString()}`);
  }

  return (
    <Select value={teamId || "all"} onValueChange={(v) => setParam("teamId", v)}>
      <SelectTrigger className="h-8 w-[180px]">
        <SelectValue placeholder="Team" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All teams</SelectItem>
        {teams.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
