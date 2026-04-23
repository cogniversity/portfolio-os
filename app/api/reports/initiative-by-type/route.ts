import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { csvResponse, toCSV } from "@/lib/csv";

export async function GET(req: NextRequest) {
  await requireUser();
  const sp = req.nextUrl.searchParams;
  const typeId = sp.get("typeId") ?? undefined;

  const initiatives = await prisma.initiative.findMany({
    where: typeId ? { typeId } : undefined,
    include: {
      type: { include: { fields: { orderBy: { orderIndex: "asc" } } } },
      owner: true,
      products: { include: { product: true } },
      fieldValues: { include: { definition: true } },
    },
    orderBy: [{ typeId: "asc" }, { targetDate: "asc" }],
  });

  const allFieldKeys = new Set<string>();
  const labelByKey = new Map<string, string>();
  for (const i of initiatives) {
    for (const v of i.fieldValues) {
      allFieldKeys.add(v.definition.key);
      labelByKey.set(v.definition.key, v.definition.label);
    }
    for (const f of i.type?.fields ?? []) {
      allFieldKeys.add(f.key);
      labelByKey.set(f.key, f.label);
    }
  }
  const fieldKeys = Array.from(allFieldKeys).sort();

  const rows = initiatives.map((i) => {
    const byKey = new Map(
      i.fieldValues.map((v) => [v.definition.key, v.value]),
    );
    const base: Record<string, unknown> = {
      type: i.type?.name ?? "Untyped",
      initiative: i.name,
      owner: i.owner?.name ?? "",
      products: i.products.map((p) => p.product.name).join(", "),
      status: i.status,
      priority: i.priority,
      start: i.startDate ? i.startDate.toISOString().slice(0, 10) : "",
      target: i.targetDate ? i.targetDate.toISOString().slice(0, 10) : "",
    };
    for (const k of fieldKeys) {
      const raw = byKey.get(k);
      base[`cf_${k}`] =
        raw == null
          ? ""
          : typeof raw === "object"
            ? JSON.stringify(raw)
            : String(raw);
    }
    return base;
  });

  const columns = [
    { key: "type", header: "Type" },
    { key: "initiative", header: "Initiative" },
    { key: "owner", header: "Owner" },
    { key: "products", header: "Products" },
    { key: "status", header: "Status" },
    { key: "priority", header: "Priority" },
    { key: "start", header: "Start" },
    { key: "target", header: "Target" },
    ...fieldKeys.map((k) => ({
      key: `cf_${k}`,
      header: labelByKey.get(k) ?? k,
    })),
  ] as Array<{ key: string; header: string }>;

  return csvResponse(
    "initiatives-by-type.csv",
    toCSV(rows as any, columns as any),
  );
}
