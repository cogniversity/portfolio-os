import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { KanbanBoard } from "./kanban-board";

type SP = {
  scope?: string;
  productId?: string;
  releaseId?: string;
  kind?: string;
};

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await requireUser();
  const sp = await searchParams;
  const scope = sp.scope === "release" ? "release" : "product";
  const kind = sp.kind === "epic" ? "epic" : sp.kind === "task" ? "task" : "story";

  const [products, releases] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.release.findMany({
      orderBy: { plannedDate: "asc" },
      select: { id: true, name: true, version: true, productId: true },
    }),
  ]);

  const productId = sp.productId ?? products[0]?.id ?? null;
  const releaseId =
    scope === "release"
      ? sp.releaseId ?? releases.find((r) => r.productId === productId)?.id ?? null
      : null;

  let stories: Array<{
    id: string;
    name: string;
    status: string;
    priority: string;
    epicId: string;
    epicName: string;
    assignee: { name: string | null; image: string | null } | null;
    owner: { name: string | null; image: string | null } | null;
  }> = [];
  let epics: Array<{
    id: string;
    name: string;
    status: string;
    priority: string;
    owner: { name: string | null; image: string | null } | null;
  }> = [];
  let tasks: Array<{
    id: string;
    name: string;
    status: string;
    priority: string;
    storyId: string;
    storyName: string;
    assignee: { name: string | null; image: string | null } | null;
    owner: { name: string | null; image: string | null } | null;
  }> = [];

  if (scope === "product" && productId) {
    const storyRows = await prisma.story.findMany({
      where: {
        epic: {
          OR: [
            { initiative: { products: { some: { productId } } } },
            { productId },
          ],
        },
      },
      include: {
        epic: { select: { id: true, name: true } },
        owner: { select: { name: true, image: true } },
        assignee: { select: { name: true, image: true } },
      },
      orderBy: [{ priority: "asc" }, { orderIndex: "asc" }],
    });
    stories = storyRows.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      priority: s.priority,
      epicId: s.epicId,
      epicName: s.epic.name,
      owner: s.owner,
      assignee: s.assignee,
    }));

    const epicRows = await prisma.epic.findMany({
      where: {
        OR: [
          { initiative: { products: { some: { productId } } } },
          { productId },
        ],
      },
      include: { owner: { select: { name: true, image: true } } },
      orderBy: [{ priority: "asc" }, { orderIndex: "asc" }],
    });
    epics = epicRows.map((e) => ({
      id: e.id,
      name: e.name,
      status: e.status,
      priority: e.priority,
      owner: e.owner,
    }));

    const taskRows = await prisma.task.findMany({
      where: {
        story: {
          epic: {
            OR: [
              { initiative: { products: { some: { productId } } } },
              { productId },
            ],
          },
        },
      },
      include: {
        story: { select: { id: true, name: true } },
        owner: { select: { name: true, image: true } },
        assignee: { select: { name: true, image: true } },
      },
      orderBy: [{ priority: "asc" }, { orderIndex: "asc" }],
    });
    tasks = taskRows.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      priority: t.priority,
      storyId: t.storyId,
      storyName: t.story.name,
      owner: t.owner,
      assignee: t.assignee,
    }));
  } else if (scope === "release" && releaseId) {
    const rel = await prisma.release.findUnique({
      where: { id: releaseId },
      include: {
        epics: {
          include: {
            epic: {
              include: {
                owner: { select: { name: true, image: true } },
                stories: {
                  include: {
                    epic: { select: { id: true, name: true } },
                    owner: { select: { name: true, image: true } },
                    assignee: { select: { name: true, image: true } },
                  },
                },
              },
            },
          },
        },
        stories: {
          include: {
            story: {
              include: {
                epic: { select: { id: true, name: true } },
                owner: { select: { name: true, image: true } },
                assignee: { select: { name: true, image: true } },
              },
            },
          },
        },
      },
    });
    if (rel) {
      const storyMap = new Map<string, typeof stories[number]>();
      for (const re of rel.epics) {
        const e = re.epic;
        epics.push({
          id: e.id,
          name: e.name,
          status: e.status,
          priority: e.priority,
          owner: e.owner,
        });
        for (const s of e.stories) {
          storyMap.set(s.id, {
            id: s.id,
            name: s.name,
            status: s.status,
            priority: s.priority,
            epicId: s.epicId,
            epicName: s.epic.name,
            owner: s.owner,
            assignee: s.assignee,
          });
        }
      }
      for (const rs of rel.stories) {
        const s = rs.story;
        storyMap.set(s.id, {
          id: s.id,
          name: s.name,
          status: s.status,
          priority: s.priority,
          epicId: s.epicId,
          epicName: s.epic.name,
          owner: s.owner,
          assignee: s.assignee,
        });
      }
      stories = Array.from(storyMap.values());
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Kanban"
        description="Drag cards between columns to update status."
      />
      <div className="flex-1 overflow-auto p-6">
        <KanbanBoard
          scope={scope}
          kind={kind}
          productId={productId}
          releaseId={releaseId}
          products={products}
          releases={releases}
          stories={stories}
          epics={epics}
          tasks={tasks}
        />
      </div>
    </div>
  );
}
