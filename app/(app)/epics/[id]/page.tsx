import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, canWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/work/status-badge";
import { PriorityBadge } from "@/components/work/priority-badge";
import { OwnerAvatar } from "@/components/work/owner-avatar";
import { formatDate } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkItemRowList } from "@/components/work/work-item-row";
import { ActivityFeed } from "@/components/collab/activity-feed";
import { Comments } from "@/components/collab/comments";

export default async function EpicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const epic = await prisma.epic.findUnique({
    where: { id },
    include: {
      owner: true,
      initiative: true,
      product: true,
      stories: {
        include: { owner: true, assignee: true, tasks: { select: { id: true, status: true } } },
        orderBy: { orderIndex: "asc" },
      },
    },
  });
  if (!epic) notFound();

  return (
    <div>
      <PageHeader
        title={epic.name}
        description={epic.description ?? undefined}
        breadcrumbs={
          <>
            {epic.initiative ? (
              <>
                <Link href="/initiatives">Initiatives</Link> /{" "}
                <Link href={`/initiatives/${epic.initiative.id}`}>
                  {epic.initiative.name}
                </Link>
              </>
            ) : null}
            {epic.initiative && epic.product ? <span className="mx-1">·</span> : null}
            {epic.product ? (
              <>
                <Link href="/products">Products</Link> /{" "}
                <Link href={`/products/${epic.product.id}`}>{epic.product.name}</Link>
              </>
            ) : null}
          </>
        }
        action={
          canWrite(user) && (
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/epics/${epic.id}/edit`}>Edit</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/stories/new?epicId=${epic.id}`}>
                  <Plus className="h-4 w-4" /> Add story
                </Link>
              </Button>
            </div>
          )
        }
      />
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-4">
            <Field label="Status"><StatusBadge status={epic.status} /></Field>
            <Field label="Priority"><PriorityBadge priority={epic.priority} /></Field>
            <Field label="Target"><span className="text-sm">{formatDate(epic.targetDate)}</span></Field>
            <Field label="Owner">
              <div className="flex items-center gap-2">
                <OwnerAvatar name={epic.owner?.name} image={epic.owner?.image} />
                <span className="text-sm">{epic.owner?.name ?? "Unassigned"}</span>
              </div>
            </Field>
          </CardContent>
        </Card>
        <Tabs defaultValue="stories">
          <TabsList>
            <TabsTrigger value="stories">Stories ({epic.stories.length})</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="stories">
            <WorkItemRowList
              items={epic.stories.map((s) => ({
                id: s.id,
                name: s.name,
                href: `/stories/${s.id}`,
                status: s.status,
                priority: s.priority,
                targetDate: s.targetDate,
                owner: (s.assignee ?? s.owner)
                  ? { name: (s.assignee ?? s.owner)!.name, image: (s.assignee ?? s.owner)!.image }
                  : null,
                meta: `${s.tasks.length} task${s.tasks.length === 1 ? "" : "s"}`,
              }))}
            />
          </TabsContent>
          <TabsContent value="comments">
            <Comments itemType="EPIC" itemId={epic.id} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityFeed itemType="EPIC" itemId={epic.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
