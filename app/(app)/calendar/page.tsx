import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { CalendarView } from "./calendar-view";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string; productId?: string; typeId?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.y) || now.getFullYear();
  const month = sp.m !== undefined ? Number(sp.m) : now.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const [products, types, releases, initiatives, cfValues] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.initiativeType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, key: true, color: true },
    }),
    prisma.release.findMany({
      where: {
        OR: [
          { plannedDate: { gte: monthStart, lte: monthEnd } },
          { actualDate: { gte: monthStart, lte: monthEnd } },
        ],
        ...(sp.productId ? { productId: sp.productId } : {}),
      },
      include: { product: { select: { id: true, name: true, color: true } } },
    }),
    prisma.initiative.findMany({
      where: {
        ...(sp.typeId ? { typeId: sp.typeId } : {}),
        ...(sp.productId
          ? { products: { some: { productId: sp.productId } } }
          : {}),
        OR: [
          { startDate: { gte: monthStart, lte: monthEnd } },
          { targetDate: { gte: monthStart, lte: monthEnd } },
        ],
      },
      include: {
        type: { select: { id: true, name: true, color: true } },
        owner: { select: { name: true, image: true } },
        products: { select: { productId: true } },
      },
    }),
    prisma.customFieldValue.findMany({
      where: {
        definition: { kind: "DATE" },
      },
      include: {
        definition: { select: { id: true, key: true, label: true, typeId: true } },
        initiative: {
          include: {
            type: { select: { id: true, name: true, color: true } },
            products: { select: { productId: true } },
          },
        },
      },
    }),
  ]);

  type Event = {
    id: string;
    date: Date;
    kind: "release" | "initiative-start" | "initiative-target" | "custom-date";
    label: string;
    href: string;
    color: string;
    secondary?: string;
  };

  const events: Event[] = [];

  for (const r of releases) {
    if (r.plannedDate && r.plannedDate >= monthStart && r.plannedDate <= monthEnd) {
      events.push({
        id: `rel-p-${r.id}`,
        date: r.plannedDate,
        kind: "release",
        label: `${r.name}${r.version ? ` ${r.version}` : ""}`,
        href: `/releases/${r.id}`,
        color: r.product.color ?? "#6366f1",
        secondary: r.product.name,
      });
    }
    if (r.actualDate && r.actualDate >= monthStart && r.actualDate <= monthEnd) {
      events.push({
        id: `rel-a-${r.id}`,
        date: r.actualDate,
        kind: "release",
        label: `${r.name} released`,
        href: `/releases/${r.id}`,
        color: r.product.color ?? "#10b981",
        secondary: r.product.name,
      });
    }
  }

  for (const i of initiatives) {
    if (sp.productId && !i.products.some((p) => p.productId === sp.productId)) continue;
    if (i.startDate && i.startDate >= monthStart && i.startDate <= monthEnd) {
      events.push({
        id: `i-s-${i.id}`,
        date: i.startDate,
        kind: "initiative-start",
        label: `Start: ${i.name}`,
        href: `/initiatives/${i.id}`,
        color: i.type?.color ?? "#6366f1",
        secondary: i.type?.name,
      });
    }
    if (i.targetDate && i.targetDate >= monthStart && i.targetDate <= monthEnd) {
      events.push({
        id: `i-t-${i.id}`,
        date: i.targetDate,
        kind: "initiative-target",
        label: `Target: ${i.name}`,
        href: `/initiatives/${i.id}`,
        color: i.type?.color ?? "#6366f1",
        secondary: i.type?.name,
      });
    }
  }

  for (const v of cfValues) {
    const raw = v.value;
    const parsed = raw ? new Date(String(raw)) : null;
    if (!parsed || isNaN(parsed.getTime())) continue;
    if (parsed < monthStart || parsed > monthEnd) continue;
    if (sp.typeId && v.initiative.typeId !== sp.typeId) continue;
    if (sp.productId && !v.initiative.products.some((p) => p.productId === sp.productId)) continue;
    events.push({
      id: `cf-${v.id}`,
      date: parsed,
      kind: "custom-date",
      label: `${v.definition.label}: ${v.initiative.name}`,
      href: `/initiatives/${v.initiative.id}`,
      color: v.initiative.type?.color ?? "#8b5cf6",
      secondary: v.initiative.type?.name,
    });
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Calendar"
        description="Releases, demo dates, events, and PoV milestones."
      />
      <div className="flex-1 overflow-auto p-6">
        <CalendarView
          year={year}
          month={month}
          products={products}
          types={types}
          filters={{ productId: sp.productId ?? "", typeId: sp.typeId ?? "" }}
          events={events.map((e) => ({
            ...e,
            date: e.date.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
