import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Button } from "@/components/ui/button";
import { WorkItemRowList, type WorkItemRowData } from "@/components/work/work-item-row";
import { canWrite } from "@/lib/rbac";

export default async function PortfoliosPage() {
  const user = await requireUser();
  const portfolios = await prisma.portfolio.findMany({
    include: { owner: true, products: { select: { id: true } } },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  });

  const items: WorkItemRowData[] = portfolios.map((p) => ({
    id: p.id,
    name: p.name,
    href: `/portfolios/${p.id}`,
    status: p.status,
    priority: p.priority,
    targetDate: p.targetDate,
    owner: p.owner ? { name: p.owner.name, image: p.owner.image } : null,
    meta: `${p.products.length} product${p.products.length === 1 ? "" : "s"}`,
  }));

  return (
    <div>
      <PageHeader
        title="Portfolios"
        description="Top-level groupings across your organization."
        action={
          canWrite(user) && (
            <Button asChild size="sm">
              <Link href="/portfolios/new">
                <Plus className="h-4 w-4" /> New portfolio
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
