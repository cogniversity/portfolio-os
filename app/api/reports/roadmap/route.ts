import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { csvResponse, toCSV } from "@/lib/csv";

function quarterLabel(d: Date) {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

export async function GET(req: NextRequest) {
  await requireUser();
  const sp = req.nextUrl.searchParams;
  const productId = sp.get("productId") ?? undefined;
  const typeId = sp.get("typeId") ?? undefined;

  const initiatives = await prisma.initiative.findMany({
    where: {
      ...(typeId ? { typeId } : {}),
      ...(productId ? { products: { some: { productId } } } : {}),
    },
    include: {
      type: true,
      owner: true,
      products: { include: { product: true } },
    },
    orderBy: [{ targetDate: "asc" }],
  });

  const rows = initiatives.map((i) => {
    const refDate = i.targetDate ?? i.startDate;
    return {
      product: i.products[0]?.product.name ?? "",
      quarter: refDate ? quarterLabel(refDate) : "",
      initiative: i.name,
      type: i.type?.name ?? "",
      owner: i.owner?.name ?? "",
      priority: i.priority,
      status: i.status,
      start: i.startDate ? i.startDate.toISOString().slice(0, 10) : "",
      target: i.targetDate ? i.targetDate.toISOString().slice(0, 10) : "",
    };
  });

  return csvResponse(
    "roadmap.csv",
    toCSV(rows, [
      "product",
      "quarter",
      "initiative",
      "type",
      "owner",
      "priority",
      "status",
      "start",
      "target",
    ]),
  );
}
