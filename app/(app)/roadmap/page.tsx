import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { RoadmapView } from "./roadmap-view";

export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{
    g?: string;
    productId?: string;
    typeId?: string;
    ownerId?: string;
    status?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const granularity = (sp.g ?? "month") as "week" | "month" | "quarter" | "year";

  const [products, types, owners, initiatives, directEpics, releases] = await Promise.all([
    prisma.product.findMany({ orderBy: { orderIndex: "asc" } }),
    prisma.initiativeType.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.initiative.findMany({
      where: {
        ...(sp.typeId ? { typeId: sp.typeId } : {}),
        ...(sp.ownerId ? { ownerId: sp.ownerId } : {}),
        ...(sp.status ? { status: sp.status as any } : {}),
        ...(sp.productId ? { products: { some: { productId: sp.productId } } } : {}),
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
        productId: { not: null },
        initiativeId: null,
        ...(sp.ownerId ? { ownerId: sp.ownerId } : {}),
        ...(sp.status ? { status: sp.status as any } : {}),
        ...(sp.productId ? { productId: sp.productId } : {}),
      },
      include: { owner: true, product: true },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    }),
    prisma.release.findMany({
      where: sp.productId ? { productId: sp.productId } : undefined,
      include: { product: true },
      orderBy: { plannedDate: "asc" },
    }),
  ]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Roadmap"
        description="Drag bars to reschedule or reprioritize. Timeline shifts are previewed before applying."
      />
      <RoadmapView
        granularity={granularity}
        filters={{
          productId: sp.productId ?? "",
          typeId: sp.typeId ?? "",
          ownerId: sp.ownerId ?? "",
          status: sp.status ?? "",
        }}
        products={products}
        types={types}
        owners={owners.map((o) => ({
          id: o.id,
          name: o.name ?? o.email,
        }))}
        initiatives={[
          ...initiatives.map((i) => ({
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
          ...directEpics.map((e) => ({
            id: `epic:${e.id}`,
            name: e.name,
            startDate: e.startDate,
            endDate: e.targetDate,
            status: e.status,
            priority: e.priority,
            productIds: e.productId ? [e.productId] : [],
            typeColor: e.product?.color ?? "#6366f1",
            typeName: "Epic",
            owner: e.owner ? { name: e.owner.name, image: e.owner.image } : null,
            epics: [],
          })),
        ]}
        releases={releases.map((r) => ({
          id: r.id,
          name: r.name,
          version: r.version,
          plannedDate: r.plannedDate,
          productId: r.productId,
          productName: r.product.name,
          status: r.status,
        }))}
        canEdit={user.roles?.includes("PRODUCT_MANAGER") ?? false}
      />
    </div>
  );
}
