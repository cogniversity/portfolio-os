import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { StatusBadge } from "@/components/work/status-badge";
import { formatDate } from "@/lib/utils";
import { RELEASE_STATUS_LABELS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { ReportToolbar } from "@/components/reports/report-toolbar";
import { ReportFilters } from "../filters";

export default async function ReleasePlanReport({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string; status?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;

  const [products, releases] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.release.findMany({
      where: {
        ...(sp.productId ? { productId: sp.productId } : {}),
        ...(sp.status ? { status: sp.status as any } : {}),
      },
      include: {
        product: { select: { id: true, name: true } },
        epics: {
          include: {
            epic: {
              include: { owner: true, initiative: { include: { owner: true } } },
            },
          },
        },
        stories: {
          include: {
            story: {
              include: { owner: true, assignee: true, epic: true },
            },
          },
        },
      },
      orderBy: { plannedDate: "asc" },
    }),
  ]);

  const qs = new URLSearchParams();
  if (sp.productId) qs.set("productId", sp.productId);
  if (sp.status) qs.set("status", sp.status);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Release plan report"
        description="All releases with scope, owners, and dates."
        breadcrumbs={<Link href="/reports">Reports</Link>}
      />
      <div className="flex-1 overflow-auto p-6 print-container">
        <ReportToolbar csvHref={`/api/reports/release-plan?${qs.toString()}`}>
          <ReportFilters
            productId={sp.productId}
            status={sp.status}
            products={products}
            statuses={["PLANNED", "IN_DEVELOPMENT", "RELEASED", "DEPRECATED"]}
          />
        </ReportToolbar>

        <div className="mt-4 space-y-6">
          {releases.length === 0 && (
            <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
              No releases match these filters.
            </div>
          )}
          {releases.map((r) => (
            <section key={r.id} className="rounded-md border bg-card">
              <header className="flex flex-wrap items-center gap-2 border-b p-3">
                <h2 className="text-base font-semibold">
                  <Link
                    href={`/releases/${r.id}`}
                    className="hover:underline"
                  >
                    {r.name}
                    {r.version ? ` ${r.version}` : ""}
                  </Link>
                </h2>
                <span className="text-xs text-muted-foreground">
                  · {r.product.name}
                </span>
                <Badge variant="secondary">{RELEASE_STATUS_LABELS[r.status]}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  Planned {formatDate(r.plannedDate)}
                  {r.actualDate && ` · Actual ${formatDate(r.actualDate)}`}
                </span>
              </header>

              <div className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Item</th>
                      <th className="px-3 py-1.5 text-left font-medium">Parent</th>
                      <th className="px-3 py-1.5 text-left font-medium">Owner</th>
                      <th className="px-3 py-1.5 text-left font-medium">Status</th>
                      <th className="px-3 py-1.5 text-left font-medium">Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {r.epics.map(({ epic }) => (
                      <tr key={`e-${epic.id}`}>
                        <td className="px-3 py-1.5">
                          <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            Epic
                          </span>
                          <Link href={`/epics/${epic.id}`} className="hover:underline">
                            {epic.name}
                          </Link>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {epic.initiative?.name}
                        </td>
                        <td className="px-3 py-1.5">
                          {epic.owner?.name ?? "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          <StatusBadge status={epic.status} />
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {formatDate(epic.targetDate)}
                        </td>
                      </tr>
                    ))}
                    {r.stories.map(({ story }) => (
                      <tr key={`s-${story.id}`}>
                        <td className="px-3 py-1.5">
                          <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            Story
                          </span>
                          <Link href={`/stories/${story.id}`} className="hover:underline">
                            {story.name}
                          </Link>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {story.epic.name}
                        </td>
                        <td className="px-3 py-1.5">
                          {story.assignee?.name ?? story.owner?.name ?? "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          <StatusBadge status={story.status} />
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {formatDate(story.targetDate)}
                        </td>
                      </tr>
                    ))}
                    {r.epics.length === 0 && r.stories.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-4 text-center text-xs text-muted-foreground"
                        >
                          No scope items.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
