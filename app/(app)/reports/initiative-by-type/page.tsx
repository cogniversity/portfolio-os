import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { StatusBadge } from "@/components/work/status-badge";
import { formatDate } from "@/lib/utils";
import { ReportToolbar } from "@/components/reports/report-toolbar";
import { ReportFilters } from "../filters";

export default async function InitiativeByTypeReport({
  searchParams,
}: {
  searchParams: Promise<{ typeId?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;

  const [types, initiatives] = await Promise.all([
    prisma.initiativeType.findMany({
      orderBy: { name: "asc" },
      include: { fields: { orderBy: { orderIndex: "asc" } } },
    }),
    prisma.initiative.findMany({
      where: sp.typeId ? { typeId: sp.typeId } : undefined,
      include: {
        type: { include: { fields: { orderBy: { orderIndex: "asc" } } } },
        owner: true,
        products: { include: { product: true } },
        fieldValues: { include: { definition: true } },
      },
      orderBy: [{ typeId: "asc" }, { targetDate: "asc" }],
    }),
  ]);

  const byType = new Map<
    string,
    { type: (typeof types)[number] | null; items: typeof initiatives }
  >();
  for (const i of initiatives) {
    const k = i.typeId ?? "untyped";
    const entry = byType.get(k) ?? {
      type: i.type ?? null,
      items: [] as typeof initiatives,
    };
    entry.items.push(i);
    byType.set(k, entry);
  }

  const groups = Array.from(byType.values()).sort((a, b) =>
    (a.type?.name ?? "~Untyped").localeCompare(b.type?.name ?? "~Untyped"),
  );

  const qs = new URLSearchParams();
  if (sp.typeId) qs.set("typeId", sp.typeId);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Initiative by type"
        description="Initiatives grouped by type with custom field values."
        breadcrumbs={<Link href="/reports">Reports</Link>}
      />
      <div className="flex-1 overflow-auto p-6 print-container">
        <ReportToolbar csvHref={`/api/reports/initiative-by-type?${qs.toString()}`}>
          <ReportFilters typeId={sp.typeId} types={types} />
        </ReportToolbar>

        <div className="mt-4 space-y-6">
          {groups.length === 0 && (
            <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
              No initiatives match these filters.
            </div>
          )}
          {groups.map((g) => {
            const fields = g.type?.fields ?? [];
            return (
              <section
                key={g.type?.id ?? "untyped"}
                className="overflow-hidden rounded-md border bg-card"
              >
                <header className="flex items-center gap-2 border-b p-3">
                  {g.type && (
                    <span
                      className="h-3 w-3 rounded-sm"
                      style={{ backgroundColor: g.type.color }}
                    />
                  )}
                  <h2 className="text-base font-semibold">
                    {g.type?.name ?? "Untyped"}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    · {g.items.length} initiative{g.items.length === 1 ? "" : "s"}
                  </span>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium">
                          Initiative
                        </th>
                        <th className="px-3 py-1.5 text-left font-medium">Owner</th>
                        <th className="px-3 py-1.5 text-left font-medium">Product</th>
                        <th className="px-3 py-1.5 text-left font-medium">Status</th>
                        <th className="px-3 py-1.5 text-left font-medium">Target</th>
                        {fields.map((f) => (
                          <th
                            key={f.id}
                            className="px-3 py-1.5 text-left font-medium"
                          >
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {g.items.map((i) => {
                        const byKey = new Map(
                          i.fieldValues.map((v) => [v.definition.key, v.value]),
                        );
                        return (
                          <tr key={i.id}>
                            <td className="px-3 py-1.5">
                              <Link
                                href={`/initiatives/${i.id}`}
                                className="hover:underline"
                              >
                                {i.name}
                              </Link>
                            </td>
                            <td className="px-3 py-1.5">{i.owner?.name ?? "—"}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {i.products.map((p) => p.product.name).join(", ") || "—"}
                            </td>
                            <td className="px-3 py-1.5">
                              <StatusBadge status={i.status} />
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {formatDate(i.targetDate)}
                            </td>
                            {fields.map((f) => {
                              const raw = byKey.get(f.key);
                              return (
                                <td
                                  key={f.id}
                                  className="px-3 py-1.5 text-muted-foreground"
                                >
                                  {renderFieldValue(f.kind, raw) || "—"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function renderFieldValue(kind: string, value: unknown): string {
  if (value == null || value === "") return "";
  if (kind === "DATE") {
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return String(value);
    return d.toISOString().slice(0, 10);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
