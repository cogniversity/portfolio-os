import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { OwnerAvatar } from "@/components/work/owner-avatar";
import { RoleEditor } from "./role-editor";

export default async function UsersAdminPage() {
  await requireRole("PRODUCT_MANAGER");
  const users = await prisma.user.findMany({
    include: { roles: true, profile: { include: { team: true } } },
    orderBy: { email: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        breadcrumbs={<Link href="/settings">Settings</Link>}
      />
      <div className="p-6">
        <div className="divide-y rounded-md border bg-card">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              <OwnerAvatar name={u.name} image={u.image} size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{u.name ?? u.email}</div>
                <div className="text-xs text-muted-foreground">
                  {u.email} {u.profile?.team && <>· {u.profile.team.name}</>}
                </div>
              </div>
              <RoleEditor userId={u.id} roles={u.roles.map((r) => r.role)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
