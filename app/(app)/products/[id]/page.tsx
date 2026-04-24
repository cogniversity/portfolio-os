import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import type { WorkStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, canWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Button } from "@/components/ui/button";
import { WorkItemRowList } from "@/components/work/work-item-row";
import { BulkWorkList } from "@/components/work/bulk-work-list";
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
import { SuggestChildrenButton } from "@/components/ai/suggest-children-button";
import { isAIConfigured } from "@/lib/ai/client";
import { RoadmapView } from "@/app/(app)/roadmap/roadmap-view";
import type { Granularity } from "@/lib/timeline";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    g?: string;
    typeId?: string;
    ownerId?: string;
    status?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const granularity = (sp.g ?? "quarter") as Granularity;
  const user = await requireUser();

  const [product, users, types, roadmapInitiatives, roadmapDirectEpics, roadmapReleases] =
    await Promise.all([
      prisma.product.findUnique({
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
      }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      prisma.initiativeType.findMany({ orderBy: { name: "asc" } }),
      prisma.initiative.findMany({
        where: {
          products: { some: { productId: id } },
          ...(sp.typeId ? { typeId: sp.typeId } : {}),
          ...(sp.ownerId ? { ownerId: sp.ownerId } : {}),
          ...(sp.status ? { status: sp.status as WorkStatus } : {}),
        },
        include: {
          owner: true,
          type: true,
          products: true,
          epics: {
            include: { owner: true },
            orderBy: { orderIndex: "asc" },
          },
        },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      }),
      prisma.epic.findMany({
        where: {
          productId: id,
          initiativeId: null,
          ...(sp.ownerId ? { ownerId: sp.ownerId } : {}),
          ...(sp.status ? { status: sp.status as WorkStatus } : {}),
        },
        include: { owner: true, product: true },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      }),
      prisma.release.findMany({
        where: { productId: id },
        include: { product: true },
        orderBy: { plannedDate: "asc" },
      }),
    ]);
  if (!product) notFound();

  const canBulkEpics = canWrite(user) && product.directEpics.length > 0;

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
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/products/${product.id}/edit`}>Edit</Link>
              </Button>
              {isAIConfigured() && (
                <SuggestChildrenButton
                  parentKind="PRODUCT"
                  parentId={product.id}
                  parentName={product.name}
                />
              )}
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
        <Tabs defaultValue="roadmap">
          <TabsList>
            <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
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
          <TabsContent value="roadmap" className="mt-4 space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <p className="text-sm text-muted-foreground">
                Quarter view: previous, current, and next quarter. Drag timeline bars to reschedule (product
                managers).
              </p>
              <Link
                href={`/roadmap?productId=${product.id}&g=quarter`}
                className="shrink-0 text-xs text-muted-foreground hover:underline"
              >
                Open full-screen roadmap
              </Link>
            </div>
            <div className="flex h-[min(70vh,780px)] min-h-[420px] flex-col overflow-hidden rounded-md border bg-card">
              <RoadmapView
                granularity={granularity}
                filters={{
                  productId: product.id,
                  typeId: sp.typeId ?? "",
                  ownerId: sp.ownerId ?? "",
                  status: sp.status ?? "",
                }}
                products={[{ id: product.id, name: product.name, color: product.color }]}
                types={types}
                owners={users.map((o) => ({
                  id: o.id,
                  name: o.name ?? o.email,
                }))}
                initiatives={[
                  ...roadmapInitiatives.map((i) => ({
                    id: i.id,
                    name: i.name,
                    startDate: i.startDate,
                    endDate: i.targetDate,
                    status: i.status,
                    priority: i.priority,
                    productIds: i.products.map((p) => p.productId),
                    typeColor: i.type?.color ?? "#6366f1",
                    typeName: i.type?.name,
                    owner: i.owner ? { name: i.owner.name, image: i.owner.image } : null,
                    epics: i.epics.map((e) => ({
                      id: e.id,
                      name: e.name,
                      startDate: e.startDate,
                      endDate: e.targetDate,
                      status: e.status,
                      priority: e.priority,
                      owner: e.owner ? { name: e.owner.name, image: e.owner.image } : null,
                    })),
                  })),
                  ...roadmapDirectEpics.map((e) => ({
                    id: `epic:${e.id}`,
                    name: e.name,
                    startDate: e.startDate,
                    endDate: e.targetDate,
                    status: e.status,
                    priority: e.priority,
                    productIds: e.productId ? [e.productId] : [],
                    typeColor: e.product?.color ?? "#6366f1",
                    typeName: "Epic" as const,
                    owner: e.owner ? { name: e.owner.name, image: e.owner.image } : null,
                    epics: [],
                  })),
                ]}
                releases={roadmapReleases.map((r) => ({
                  id: r.id,
                  name: r.name,
                  version: r.version,
                  plannedDate: r.plannedDate,
                  productId: r.productId,
                  productName: r.product.name,
                  status: r.status,
                }))}
                canEdit={user.roles?.includes("PRODUCT_MANAGER") ?? false}
                embedPath={`/products/${product.id}`}
                timeWindow="threeQuarters"
                hideProductFilter
              />
            </div>
          </TabsContent>
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
              <BulkWorkList
                kind="epic"
                productId={product.id}
                canBulk={canBulkEpics}
                users={users}
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
