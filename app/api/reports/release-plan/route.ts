import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { csvResponse, toCSV } from "@/lib/csv";

export async function GET(req: NextRequest) {
  await requireUser();
  const sp = req.nextUrl.searchParams;
  const productId = sp.get("productId") ?? undefined;
  const status = sp.get("status") ?? undefined;

  const releases = await prisma.release.findMany({
    where: {
      ...(productId ? { productId } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      product: { select: { name: true } },
      epics: {
        include: {
          epic: {
            include: { owner: true, initiative: true },
          },
        },
      },
      stories: {
        include: {
          story: { include: { owner: true, assignee: true, epic: true } },
        },
      },
    },
    orderBy: { plannedDate: "asc" },
  });

  const rows: Array<Record<string, string | number>> = [];
  for (const r of releases) {
    const base = {
      product: r.product.name,
      release: r.name + (r.version ? ` ${r.version}` : ""),
      release_status: r.status,
      planned_date: r.plannedDate ? r.plannedDate.toISOString().slice(0, 10) : "",
      actual_date: r.actualDate ? r.actualDate.toISOString().slice(0, 10) : "",
    };
    for (const { epic } of r.epics) {
      rows.push({
        ...base,
        kind: "Epic",
        item: epic.name,
        parent: epic.initiative?.name ?? "",
        owner: epic.owner?.name ?? "",
        assignee: "",
        status: epic.status,
        target_date: epic.targetDate ? epic.targetDate.toISOString().slice(0, 10) : "",
      });
    }
    for (const { story } of r.stories) {
      rows.push({
        ...base,
        kind: "Story",
        item: story.name,
        parent: story.epic.name,
        owner: story.owner?.name ?? "",
        assignee: story.assignee?.name ?? "",
        status: story.status,
        target_date: story.targetDate ? story.targetDate.toISOString().slice(0, 10) : "",
      });
    }
    if (r.epics.length === 0 && r.stories.length === 0) {
      rows.push({ ...base, kind: "", item: "", parent: "", owner: "", assignee: "", status: "", target_date: "" });
    }
  }

  const csv = toCSV(rows, [
    "product",
    "release",
    "release_status",
    "planned_date",
    "actual_date",
    "kind",
    "item",
    "parent",
    "owner",
    "assignee",
    "status",
    "target_date",
  ]);
  return csvResponse("release-plan.csv", csv);
}
