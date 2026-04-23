import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/work/status-badge";
import { PriorityBadge } from "@/components/work/priority-badge";
import { OwnerAvatar } from "@/components/work/owner-avatar";
import { formatDate } from "@/lib/utils";
import { INITIATIVE_TYPE_COLORS } from "@/lib/constants";
import {
  Activity,
  CheckCircle2,
  Rocket,
  Target,
  TriangleAlert,
} from "lucide-react";
import { DashboardTimeline } from "./dashboard-timeline";

function startOfQuarter(d: Date) {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}
function endOfQuarter(d: Date) {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string; productId?: string; typeId?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const granularity = (sp.g ?? "quarter") as "week" | "month" | "quarter" | "year";

  const now = new Date();
  const qStart = startOfQuarter(now);
  const qEnd = endOfQuarter(now);

  const [
    publishedThisQ,
    upcomingReleases,
    initiatives,
    initiativesByType,
    products,
    types,
    recentActivity,
  ] = await Promise.all([
    prisma.release.count({
      where: {
        status: "RELEASED",
        actualDate: { gte: qStart, lte: qEnd },
      },
    }),
    prisma.release.findMany({
      where: {
        status: { in: ["PLANNED", "IN_DEVELOPMENT"] },
        plannedDate: { gte: now },
      },
      include: { product: { select: { id: true, name: true, color: true } } },
      orderBy: { plannedDate: "asc" },
      take: 8,
    }),
    prisma.initiative.findMany({
      where: {
        ...(sp.typeId ? { typeId: sp.typeId } : {}),
        ...(sp.productId
          ? { products: { some: { productId: sp.productId } } }
          : {}),
      },
      include: {
        type: { select: { id: true, name: true, color: true } },
        owner: { select: { name: true, image: true } },
        products: { select: { productId: true } },
      },
    }),
    prisma.initiative.groupBy({
      by: ["typeId"],
      _count: { _all: true },
    }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.initiativeType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { actor: { select: { name: true, image: true } } },
    }),
  ]);

  const typeById = new Map(types.map((t) => [t.id, t]));

  const total = initiatives.length;
  const atRisk = initiatives.filter((i) => {
    if (i.status === "DONE" || i.status === "RELEASED" || i.status === "CANCELLED") {
      return false;
    }
    return !!i.targetDate && i.targetDate < now;
  }).length;
  const onTrack = initiatives.filter(
    (i) =>
      i.status !== "CANCELLED" &&
      (!i.targetDate || i.targetDate >= now) &&
      i.status !== "DONE" &&
      i.status !== "RELEASED",
  ).length;
  const completed = initiatives.filter(
    (i) => i.status === "DONE" || i.status === "RELEASED",
  ).length;
  const onTrackPct = total === 0 ? 0 : Math.round((onTrack / Math.max(1, total - completed)) * 100);

  const pieData = initiativesByType
    .map((g, i) => {
      const t = g.typeId ? typeById.get(g.typeId) : null;
      return {
        id: g.typeId ?? "untyped",
        label: t?.name ?? "Untyped",
        count: g._count._all,
        color: t?.color ?? INITIATIVE_TYPE_COLORS[i % INITIATIVE_TYPE_COLORS.length],
      };
    })
    .sort((a, b) => b.count - a.count);
  const pieTotal = pieData.reduce((s, d) => s + d.count, 0);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Dashboard"
        description="What's published, what's planned, and what's at risk."
      />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid gap-3 md:grid-cols-4">
          <Kpi
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Released this quarter"
            value={publishedThisQ}
          />
          <Kpi
            icon={<Rocket className="h-4 w-4" />}
            label="Upcoming releases"
            value={upcomingReleases.length}
          />
          <Kpi
            icon={<Target className="h-4 w-4" />}
            label="On-track rate"
            value={`${onTrackPct}%`}
            subtle={`${onTrack} of ${Math.max(1, total - completed)} active`}
          />
          <Kpi
            icon={<TriangleAlert className="h-4 w-4" />}
            label="At-risk initiatives"
            value={atRisk}
            tone="text-red-600 dark:text-red-400"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-4 lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold">What&apos;s planned</h2>
            <DashboardTimeline
              granularity={granularity}
              products={products}
              types={types}
              filters={{ productId: sp.productId ?? "", typeId: sp.typeId ?? "" }}
              items={initiatives
                .filter((i) => i.startDate || i.targetDate)
                .map((i) => ({
                  id: i.id,
                  name: i.name,
                  startDate: (i.startDate ?? i.targetDate)!.toISOString(),
                  endDate: (i.targetDate ?? i.startDate)!.toISOString(),
                  typeColor: i.type?.color ?? "#6366f1",
                  typeName: i.type?.name ?? null,
                  status: i.status,
                  priority: i.priority,
                  owner: i.owner ? { name: i.owner.name, image: i.owner.image } : null,
                  href: `/initiatives/${i.id}`,
                }))}
              upcomingReleases={upcomingReleases.map((r) => ({
                id: r.id,
                name: r.name,
                version: r.version,
                plannedDate: r.plannedDate ? r.plannedDate.toISOString() : null,
                productName: r.product.name,
                color: r.product.color ?? "#6366f1",
              }))}
            />
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Initiatives by type</h2>
            {pieData.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No initiatives yet.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex h-2.5 w-full overflow-hidden rounded">
                  {pieData.map((d) => (
                    <div
                      key={d.id}
                      title={`${d.label}: ${d.count}`}
                      style={{
                        width: `${(d.count / Math.max(1, pieTotal)) * 100}%`,
                        backgroundColor: d.color,
                      }}
                    />
                  ))}
                </div>
                <ul className="space-y-1.5 text-sm">
                  {pieData.map((d) => (
                    <li key={d.id} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: d.color }}
                        />
                        {d.label}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {d.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Upcoming releases</h2>
            {upcomingReleases.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No upcoming releases.
              </div>
            ) : (
              <ul className="divide-y">
                {upcomingReleases.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/releases/${r.id}`}
                      className="flex items-center gap-3 py-2 hover:bg-accent/50"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: r.product.color ?? "#6366f1" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {r.name}
                          {r.version ? ` · ${r.version}` : ""}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {r.product.name}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {r.plannedDate ? formatDate(r.plannedDate) : "TBD"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4" /> Recent activity
            </h2>
            {recentActivity.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No activity yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {recentActivity.map((a) => (
                  <li key={a.id} className="flex items-start gap-2">
                    <OwnerAvatar name={a.actor?.name} image={a.actor?.image} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{a.summary}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatDate(a.createdAt)} · {a.itemType.toLowerCase()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">
            At-risk initiatives ({atRisk})
          </h2>
          {atRisk === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No items past target.
            </div>
          ) : (
            <ul className="divide-y">
              {initiatives
                .filter(
                  (i) =>
                    i.status !== "DONE" &&
                    i.status !== "RELEASED" &&
                    i.status !== "CANCELLED" &&
                    !!i.targetDate &&
                    i.targetDate < now,
                )
                .slice(0, 10)
                .map((i) => (
                  <li key={i.id}>
                    <Link
                      href={`/initiatives/${i.id}`}
                      className="flex items-center gap-3 py-2 hover:bg-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{i.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {i.type?.name ?? "Untyped"}
                        </div>
                      </div>
                      <PriorityBadge priority={i.priority} />
                      <StatusBadge status={i.status} />
                      <div className="w-24 shrink-0 text-right text-xs text-red-600 dark:text-red-400">
                        {i.targetDate ? formatDate(i.targetDate) : ""}
                      </div>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  subtle,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  subtle?: string;
  tone?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${tone ?? ""}`}>
        {value}
      </div>
      {subtle && <div className="mt-1 text-[11px] text-muted-foreground">{subtle}</div>}
    </Card>
  );
}
