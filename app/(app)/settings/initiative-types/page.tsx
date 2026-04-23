import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function InitiativeTypesPage() {
  await requireRole("PRODUCT_MANAGER");
  const types = await prisma.initiativeType.findMany({
    include: { fields: true, _count: { select: { initiatives: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Initiative Types"
        description="Built-in and custom types with their field definitions."
        breadcrumbs={<Link href="/settings">Settings</Link>}
        action={
          <Button asChild size="sm">
            <Link href="/settings/initiative-types/new">
              <Plus className="h-4 w-4" /> New type
            </Link>
          </Button>
        }
      />
      <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => (
          <Link key={t.id} href={`/settings/initiative-types/${t.id}`}>
            <Card className="transition-colors hover:bg-accent/40">
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="font-medium">{t.name}</span>
                  </div>
                  {t.isBuiltIn && <Badge variant="secondary">Built-in</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.fields.length} field{t.fields.length === 1 ? "" : "s"} · {t._count.initiatives} initiative
                  {t._count.initiatives === 1 ? "" : "s"}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
