import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { TeamsClient } from "./teams-client";

export default async function TeamsAdminPage() {
  await requireRole("PRODUCT_MANAGER");
  const teams = await prisma.team.findMany({
    include: { _count: { select: { profiles: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <div>
      <PageHeader title="Teams" breadcrumbs={<Link href="/settings">Settings</Link>} />
      <div className="p-6">
        <TeamsClient teams={teams.map((t) => ({ id: t.id, name: t.name, memberCount: t._count.profiles }))} />
      </div>
    </div>
  );
}
