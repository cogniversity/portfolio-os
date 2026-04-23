import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, canWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Button } from "@/components/ui/button";
import { WorkItemRowList } from "@/components/work/work-item-row";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/work/status-badge";
import { PriorityBadge } from "@/components/work/priority-badge";
import { OwnerAvatar } from "@/components/work/owner-avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityFeed } from "@/components/collab/activity-feed";
import { Comments } from "@/components/collab/comments";
import { formatDate } from "@/lib/utils";

export default async function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const portfolio = await prisma.portfolio.findUnique({
    where: { id },
    include: {
      owner: true,
      products: {
        include: { owner: true, initiatives: { select: { initiativeId: true } } },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!portfolio) notFound();

  return (
    <div>
      <PageHeader
        title={portfolio.name}
        description={portfolio.description ?? undefined}
        breadcrumbs={<Link href="/portfolios">Portfolios</Link>}
        action={
          canWrite(user) && (
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/portfolios/${portfolio.id}/edit`}>Edit</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/products/new?portfolioId=${portfolio.id}`}>
                  <Plus className="h-4 w-4" /> Add product
                </Link>
              </Button>
            </div>
          )
        }
      />
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-4">
            <Field label="Status"><StatusBadge status={portfolio.status} /></Field>
            <Field label="Priority"><PriorityBadge priority={portfolio.priority} /></Field>
            <Field label="Target"><span className="text-sm">{formatDate(portfolio.targetDate)}</span></Field>
            <Field label="Owner">
              <div className="flex items-center gap-2">
                <OwnerAvatar name={portfolio.owner?.name} image={portfolio.owner?.image} />
                <span className="text-sm">{portfolio.owner?.name ?? "Unassigned"}</span>
              </div>
            </Field>
          </CardContent>
        </Card>
        <Tabs defaultValue="products">
          <TabsList>
            <TabsTrigger value="products">
              Products ({portfolio.products.length})
            </TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="products">
            <WorkItemRowList
              items={portfolio.products.map((p) => ({
                id: p.id,
                name: p.name,
                href: `/products/${p.id}`,
                status: p.status,
                priority: p.priority,
                targetDate: p.targetDate,
                owner: p.owner ? { name: p.owner.name, image: p.owner.image } : null,
                meta: `${p.initiatives.length} initiative${p.initiatives.length === 1 ? "" : "s"}`,
              }))}
            />
          </TabsContent>
          <TabsContent value="comments">
            <Comments itemType="PORTFOLIO" itemId={portfolio.id} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityFeed itemType="PORTFOLIO" itemId={portfolio.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
