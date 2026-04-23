import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { StatusBadge } from "@/components/work/status-badge";
import { PriorityBadge } from "@/components/work/priority-badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Priority, WorkStatus } from "@prisma/client";

type WorkRow = {
  id: string;
  kind: "initiative" | "epic" | "story" | "task";
  name: string;
  href: string;
  status: WorkStatus;
  priority: Priority;
  targetDate: Date | null;
  parent?: string;
  role: "owner" | "assignee";
};

function bucketFor(date: Date | null): "overdue" | "this" | "next" | "later" | "none" {
  if (!date) return "none";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = 86400000;
  const dow = today.getDay();
  const endThis = new Date(today.getTime() + (6 - dow) * day);
  const endNext = new Date(endThis.getTime() + 7 * day);
  if (date < today) return "overdue";
  if (date <= endThis) return "this";
  if (date <= endNext) return "next";
  return "later";
}

const BUCKETS: Array<{
  key: "overdue" | "this" | "next" | "later" | "none";
  label: string;
  tone: string;
}> = [
  { key: "overdue", label: "Overdue", tone: "text-red-600 dark:text-red-400" },
  { key: "this", label: "This week", tone: "text-orange-600 dark:text-orange-400" },
  { key: "next", label: "Next week", tone: "text-blue-600 dark:text-blue-400" },
  { key: "later", label: "Later", tone: "text-muted-foreground" },
  { key: "none", label: "No date", tone: "text-muted-foreground" },
];

export default async function MyWorkPage() {
  const user = await requireUser();

  const [
    ownedInitiatives,
    ownedEpics,
    ownedStories,
    assignedStories,
    ownedTasks,
    assignedTasks,
  ] = await Promise.all([
    prisma.initiative.findMany({
      where: { ownerId: user.id },
      orderBy: [{ targetDate: "asc" }, { priority: "asc" }],
    }),
    prisma.epic.findMany({
      where: { ownerId: user.id },
      include: { initiative: { select: { id: true, name: true } } },
      orderBy: [{ targetDate: "asc" }, { priority: "asc" }],
    }),
    prisma.story.findMany({
      where: { ownerId: user.id },
      include: { epic: { select: { id: true, name: true } } },
      orderBy: [{ targetDate: "asc" }, { priority: "asc" }],
    }),
    prisma.story.findMany({
      where: { assigneeId: user.id, NOT: { ownerId: user.id } },
      include: { epic: { select: { id: true, name: true } } },
      orderBy: [{ targetDate: "asc" }, { priority: "asc" }],
    }),
    prisma.task.findMany({
      where: { ownerId: user.id },
      include: { story: { select: { id: true, name: true } } },
      orderBy: [{ targetDate: "asc" }, { priority: "asc" }],
    }),
    prisma.task.findMany({
      where: { assigneeId: user.id, NOT: { ownerId: user.id } },
      include: { story: { select: { id: true, name: true } } },
      orderBy: [{ targetDate: "asc" }, { priority: "asc" }],
    }),
  ]);

  const rows: WorkRow[] = [
    ...ownedInitiatives.map(
      (i): WorkRow => ({
        id: i.id,
        kind: "initiative",
        name: i.name,
        href: `/initiatives/${i.id}`,
        status: i.status,
        priority: i.priority,
        targetDate: i.targetDate,
        role: "owner",
      }),
    ),
    ...ownedEpics.map(
      (e): WorkRow => ({
        id: e.id,
        kind: "epic",
        name: e.name,
        href: `/epics/${e.id}`,
        status: e.status,
        priority: e.priority,
        targetDate: e.targetDate,
        parent: e.initiative.name,
        role: "owner",
      }),
    ),
    ...ownedStories.map(
      (s): WorkRow => ({
        id: s.id,
        kind: "story",
        name: s.name,
        href: `/stories/${s.id}`,
        status: s.status,
        priority: s.priority,
        targetDate: s.targetDate,
        parent: s.epic.name,
        role: "owner",
      }),
    ),
    ...assignedStories.map(
      (s): WorkRow => ({
        id: s.id,
        kind: "story",
        name: s.name,
        href: `/stories/${s.id}`,
        status: s.status,
        priority: s.priority,
        targetDate: s.targetDate,
        parent: s.epic.name,
        role: "assignee",
      }),
    ),
    ...ownedTasks.map(
      (t): WorkRow => ({
        id: t.id,
        kind: "task",
        name: t.name,
        href: `/stories/${t.storyId}`,
        status: t.status,
        priority: t.priority,
        targetDate: t.targetDate,
        parent: t.story.name,
        role: "owner",
      }),
    ),
    ...assignedTasks.map(
      (t): WorkRow => ({
        id: t.id,
        kind: "task",
        name: t.name,
        href: `/stories/${t.storyId}`,
        status: t.status,
        priority: t.priority,
        targetDate: t.targetDate,
        parent: t.story.name,
        role: "assignee",
      }),
    ),
  ];

  const active = rows.filter(
    (r) => r.status !== "DONE" && r.status !== "RELEASED" && r.status !== "CANCELLED",
  );

  const byBucket = new Map<string, WorkRow[]>();
  for (const b of BUCKETS) byBucket.set(b.key, []);
  for (const r of active) {
    byBucket.get(bucketFor(r.targetDate))!.push(r);
  }

  const byStatus = new Map<WorkStatus, WorkRow[]>();
  for (const r of active) {
    const arr = byStatus.get(r.status) ?? [];
    arr.push(r);
    byStatus.set(r.status, arr);
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="My Work"
        description={`${active.length} active item${active.length === 1 ? "" : "s"} assigned to or owned by you.`}
      />
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="due" className="space-y-4">
          <TabsList>
            <TabsTrigger value="due">By due date</TabsTrigger>
            <TabsTrigger value="status">By status</TabsTrigger>
          </TabsList>

          <TabsContent value="due" className="space-y-4">
            {BUCKETS.map((b) => {
              const items = byBucket.get(b.key) ?? [];
              if (items.length === 0) return null;
              return (
                <section key={b.key}>
                  <h2 className={`mb-2 text-sm font-semibold ${b.tone}`}>
                    {b.label} · {items.length}
                  </h2>
                  <Card className="divide-y">
                    {items.map((r) => (
                      <RowCard key={`${r.kind}-${r.id}`} row={r} />
                    ))}
                  </Card>
                </section>
              );
            })}
            {active.length === 0 && <EmptyState />}
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            {Array.from(byStatus.entries()).map(([status, items]) => (
              <section key={status}>
                <div className="mb-2 flex items-center gap-2">
                  <StatusBadge status={status} />
                  <span className="text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <Card className="divide-y">
                  {items.map((r) => (
                    <RowCard key={`${r.kind}-${r.id}`} row={r} />
                  ))}
                </Card>
              </section>
            ))}
            {active.length === 0 && <EmptyState />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function RowCard({ row }: { row: WorkRow }) {
  return (
    <Link
      href={row.href}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50"
    >
      <span className="w-16 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
        {row.kind}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{row.name}</div>
        {row.parent && (
          <div className="truncate text-[11px] text-muted-foreground">
            {row.parent}
          </div>
        )}
      </div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {row.role}
      </span>
      <PriorityBadge priority={row.priority} />
      <StatusBadge status={row.status} />
      <div className="w-24 shrink-0 text-right text-xs text-muted-foreground">
        {row.targetDate ? formatDate(row.targetDate) : "—"}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
      You have no active work items. Enjoy the calm.
    </div>
  );
}
