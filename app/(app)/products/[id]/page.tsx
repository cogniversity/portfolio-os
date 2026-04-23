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
import { formatDate } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RELEASE_STATUS_LABELS } from "@/lib/constants";
import { ActivityFeed } from "@/components/collab/activity-feed";
import { Comments } from "@/components/collab/comments";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      owner: true,
      portfolio: true,
      initiatives: {
        include: {
          initiative: {
            include: {
              owner: true,
              type: true,
              _count: { select: { products: true } },
            },
          },
        },
      },
      directEpics: {
        include: {
          owner: true,
          _count: { select: { stories: true } },
        },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      },
      releases: { orderBy: { plannedDate: "asc" } },
    },
  });
  if (!product) notFound();

  return (
    <div>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            {product.color && (
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: product.color }}
              />
            )}
            {product.name}
          </div>
        }
        description={product.description ?? undefined}
        breadcrumbs={
          <>
            <Link href="/products">Products</Link>
            {product.portfolio && (
              <>
                {" / "}
                <Link href={`/portfolios/${product.portfolio.id}`}>
                  {product.portfolio.name}
                </Link>
              </>
            )}
          </>
        }
        action={
          canWrite(user) && (
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/products/${product.id}/edit`}>Edit</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/releases/new?productId=${product.id}`}>
                  <Plus className="h-4 w-4" /> Release
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/epics/new?productId=${product.id}`}>
                  <Plus className="h-4 w-4" /> Epic
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/initiatives/new?productId=${product.id}`}>
                  <Plus className="h-4 w-4" /> Initiative
                </Link>
              </Button>
            </div>
          )
        }
      />
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-4">
            <Field label="Status"><StatusBadge status={product.status} /></Field>
            <Field label="Priority"><PriorityBadge priority={product.priority} /></Field>
            <Field label="Target"><span className="text-sm">{formatDate(product.targetDate)}</span></Field>
            <Field label="Owner">
              <div className="flex items-center gap-2">
                <OwnerAvatar name={product.owner?.name} image={product.owner?.image} />
                <span className="text-sm">{product.owner?.name ?? "Unassigned"}</span>
              </div>
            </Field>
          </CardContent>
        </Card>
        <Tabs defaultValue="initiatives">
          <TabsList>
            <TabsTrigger value="initiatives">
              Initiatives ({product.initiatives.length})
            </TabsTrigger>
            <TabsTrigger value="epics">
              Epics (direct) ({product.directEpics.length})
            </TabsTrigger>
            <TabsTrigger value="releases">
              Releases ({product.releases.length})
            </TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="initiatives">
            <WorkItemRowList
              items={product.initiatives.map(({ initiative: i }) => {
                const shared = i._count.products > 1;
                return {
                  id: i.id,
                  name: i.name,
                  href: `/initiatives/${i.id}`,
                  status: i.status,
                  priority: i.priority,
                  targetDate: i.targetDate,
                  owner: i.owner
                    ? { name: i.owner.name, image: i.owner.image }
                    : null,
                  meta: (
                    <span className="flex items-center gap-2">
                      {i.type?.name}
                      {shared && (
                        <Badge variant="outline" className="text-[10px]">
                          Shared {i._count.products} products
                        </Badge>
                      )}
                    </span>
                  ),
                };
              })}
            />
          </TabsContent>
          <TabsContent value="epics">
            {product.directEpics.length === 0 ? (
              <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
                No epics attached directly to this product yet.
              </div>
            ) : (
              <WorkItemRowList
                items={product.directEpics.map((e) => ({
                  id: e.id,
                  name: e.name,
                  href: `/epics/${e.id}`,
                  status: e.status,
                  priority: e.priority,
                  targetDate: e.targetDate,
                  owner: e.owner
                    ? { name: e.owner.name, image: e.owner.image }
                    : null,
                  meta: `${e._count.stories} stor${e._count.stories === 1 ? "y" : "ies"}`,
                }))}
              />
            )}
          </TabsContent>
          <TabsContent value="releases">
            <div className="divide-y rounded-md border bg-card">
              {product.releases.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground">No releases yet.</div>
              )}
              {product.releases.map((r) => (
                <Link
                  key={r.id}
                  href={`/releases/${r.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {r.name} {r.version && <span className="text-muted-foreground">{r.version}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(r.plannedDate)}
                    </div>
                  </div>
                  <Badge variant="secondary">{RELEASE_STATUS_LABELS[r.status]}</Badge>
                </Link>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="comments">
            <Comments itemType="PRODUCT" itemId={product.id} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityFeed itemType="PRODUCT" itemId={product.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
