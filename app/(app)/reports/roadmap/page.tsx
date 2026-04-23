import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { StatusBadge } from "@/components/work/status-badge";
import { PriorityBadge } from "@/components/work/priority-badge";
import { formatDate } from "@/lib/utils";
import { ReportToolbar } from "@/components/reports/report-toolbar";
import { ReportFilters } from "../filters";

function quarterLabel(d: Date) {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

export default async function RoadmapReport({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string; typeId?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;

  const [products, types, initiatives] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.initiativeType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.initiative.findMany({
      where: {
        ...(sp.typeId ? { typeId: sp.typeId } : {}),
        ...(sp.productId
          ? { products: { some: { productId: sp.productId } } }
          : {}),
      },
      include: {
        type: true,
        owner: true,
        products: { include: { product: true } },
      },
      orderBy: [{ targetDate: "asc" }, { priority: "asc" }],
    }),
  ]);

  const byProductQuarter = new Map<string, typeof initiatives>();
  for (const i of initiatives) {
    const productName = i.products[0]?.product.name ?? "Unassigned product";
    const refDate = i.targetDate ?? i.startDate;
    const q = refDate ? quarterLabel(refDate) : "No date";
    const key = `${productName}::${q}`;
    const arr = byProductQuarter.get(key) ?? [];
    arr.push(i);
    byProductQuarter.set(key, arr);
  }

  const groups = Array.from(byProductQuarter.entries())
    .map(([key, items]) => {
      const [product, quarter] = key.split("::");
      return { product, quarter, items };
    })
    .sort((a, b) =>
      a.product === b.product
        ? a.quarter.localeCompare(b.quarter)
        : a.product.localeCompare(b.product),
    );

  const qs = new URLSearchParams();
  if (sp.productId) qs.set("productId", sp.productId);
  if (sp.typeId) qs.set("typeId", sp.typeId);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Roadmap export"
        description="Initiatives grouped by product and quarter."
        breadcrumbs={<Link href="/reports">Reports</Link>}
      />
      <div className="flex-1 overflow-auto p-6 print-container">
        <ReportToolbar csvHref={`/api/reports/roadmap?${qs.toString()}`}>
          <ReportFilters
            productId={sp.productId}
            typeId={sp.typeId}
            products={products}
            types={types}
          />
        </ReportToolbar>

        <div className="mt-4 space-y-6">
          {groups.length === 0 && (
            <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
              No initiatives match these filters.
            </div>
          )}
          {groups.map((g) => (
            <section key={`${g.product}-${g.quarter}`} className="rounded-md border bg-card">
              <header className="flex items-center justify-between border-b p-3">
                <h2 className="text-base font-semibold">{g.product}</h2>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {g.quarter}
                </span>
              </header>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Initiative</th>
                    <th className="px-3 py-1.5 text-left font-medium">Type</th>
                    <th className="px-3 py-1.5 text-left font-medium">Owner</th>
                    <th className="px-3 py-1.5 text-left font-medium">Priority</th>
                    <th className="px-3 py-1.5 text-left font-medium">Status</th>
                    <th className="px-3 py-1.5 text-left font-medium">Start</th>
                    <th className="px-3 py-1.5 text-left font-medium">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {g.items.map((i) => (
                    <tr key={i.id}>
                      <td className="px-3 py-1.5">
                        <Link
                          href={`/initiatives/${i.id}`}
                          className="hover:underline"
                        >
                          {i.name}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5">
                        {i.type ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-xs"
                            style={{ color: i.type.color }}
                          >
                            <span
                              className="h-2 w-2 rounded-sm"
                              style={{ backgroundColor: i.type.color }}
                            />
                            {i.type.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">{i.owner?.name ?? "—"}</td>
                      <td className="px-3 py-1.5">
                        <PriorityBadge priority={i.priority} />
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusBadge status={i.status} />
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {formatDate(i.startDate)}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {formatDate(i.targetDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
