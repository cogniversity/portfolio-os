import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, canWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Button } from "@/components/ui/button";
import { WorkItemRowList, type WorkItemRowData } from "@/components/work/work-item-row";
import { Badge } from "@/components/ui/badge";

export default async function InitiativesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await requireUser();
  const { type } = await searchParams;

  const [initiatives, types] = await Promise.all([
    prisma.initiative.findMany({
      where: type ? { type: { key: type } } : undefined,
      include: {
        owner: true,
        type: true,
        products: { include: { product: { select: { id: true, name: true } } } },
        epics: { select: { id: true, status: true } },
      },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    }),
    prisma.initiativeType.findMany({ orderBy: { name: "asc" } }),
  ]);

  const items: WorkItemRowData[] = initiatives.map((i) => {
    const done = i.epics.filter((e) => e.status === "DONE" || e.status === "RELEASED").length;
    const progress = i.epics.length > 0 ? Math.round((done / i.epics.length) * 100) : 0;
    return {
      id: i.id,
      name: i.name,
      href: `/initiatives/${i.id}`,
      status: i.status,
      priority: i.priority,
      targetDate: i.targetDate,
      owner: i.owner ? { name: i.owner.name, image: i.owner.image } : null,
      meta: (
        <span className="flex items-center gap-1.5">
          {i.type && (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: i.type.color }}
            />
          )}
          {i.type?.name ?? "No type"}
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {i.products.map((p) => p.product.name).join(", ") || "no products"}
          </span>
        </span>
      ),
      progress,
    };
  });

  return (
    <div>
      <PageHeader
        title="Initiatives"
        description="Cross-product work, customizations, demos, events, and PoVs."
        action={
          canWrite(user) && (
            <Button asChild size="sm">
              <Link href="/initiatives/new">
                <Plus className="h-4 w-4" /> New initiative
              </Link>
            </Button>
          )
        }
      />
      <div className="p-6">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <Link href="/initiatives">
            <Badge variant={!type ? "default" : "outline"}>All</Badge>
          </Link>
          {types.map((t) => (
            <Link key={t.id} href={`/initiatives?type=${t.key}`}>
              <Badge variant={type === t.key ? "default" : "outline"}>
                <span
                  className="mr-1 inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                {t.name}
              </Badge>
            </Link>
          ))}
        </div>
        <WorkItemRowList items={items} />
      </div>
    </div>
  );
}
