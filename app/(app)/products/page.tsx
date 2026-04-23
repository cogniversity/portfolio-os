import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, canWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Button } from "@/components/ui/button";
import { WorkItemRowList, type WorkItemRowData } from "@/components/work/work-item-row";

export default async function ProductsPage() {
  const user = await requireUser();
  const products = await prisma.product.findMany({
    include: {
      owner: true,
      portfolio: true,
      initiatives: { select: { initiativeId: true } },
      releases: { select: { id: true } },
    },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  });

  const items: WorkItemRowData[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    href: `/products/${p.id}`,
    status: p.status,
    priority: p.priority,
    targetDate: p.targetDate,
    owner: p.owner ? { name: p.owner.name, image: p.owner.image } : null,
    meta: `${p.portfolio?.name ?? "No portfolio"} · ${p.initiatives.length} initiatives · ${p.releases.length} releases`,
  }));

  return (
    <div>
      <PageHeader
        title="Products"
        description="Products across your portfolios."
        action={
          canWrite(user) && (
            <Button asChild size="sm">
              <Link href="/products/new">
                <Plus className="h-4 w-4" /> New product
              </Link>
            </Button>
          )
        }
      />
      <div className="p-6">
        <WorkItemRowList items={items} />
      </div>
    </div>
  );
}
