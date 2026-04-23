"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { setUserRolesAction } from "./actions";
import type { Role } from "@/lib/auth-types";

const ALL: { role: Role; label: string }[] = [
  { role: "LEADER", label: "Leader" },
  { role: "PRODUCT_MANAGER", label: "PM" },
  { role: "TEAM_MEMBER", label: "Team" },
];

export function RoleEditor({ userId, roles }: { userId: string; roles: Role[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle(role: Role, checked: boolean) {
    const next = checked ? Array.from(new Set([...roles, role])) : roles.filter((r) => r !== role);
    start(async () => {
      const res = await setUserRolesAction(userId, next);
      if (!res.ok) {
        toast.error("Failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      {ALL.map(({ role, label }) => (
        <label key={role} className="flex items-center gap-1.5 text-xs">
          <Checkbox
            checked={roles.includes(role)}
            disabled={pending}
            onCheckedChange={(v) => toggle(role, !!v)}
          />
          {label}
        </label>
      ))}
    </div>
  );
}
