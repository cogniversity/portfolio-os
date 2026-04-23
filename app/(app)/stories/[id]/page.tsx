import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, canWrite, canWriteAssigned } from "@/lib/rbac";
import { SuggestChildrenButton } from "@/components/ai/suggest-children-button";
import { isAIConfigured } from "@/lib/ai/client";
import { PageHeader } from "@/components/work/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/work/status-badge";
import { PriorityBadge } from "@/components/work/priority-badge";
import { OwnerAvatar } from "@/components/work/owner-avatar";
import { formatDate } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityFeed } from "@/components/collab/activity-feed";
import { Comments } from "@/components/collab/comments";
import { TaskList } from "./task-list";

export default async function StoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const story = await prisma.story.findUnique({
    where: { id },
    include: {
      owner: true,
      assignee: true,
      epic: { include: { initiative: true, product: true } },
      tasks: {
        include: { owner: true, assignee: true },
        orderBy: { orderIndex: "asc" },
      },
    },
  });
  if (!story) notFound();

  const canEdit = canWriteAssigned(user, story.ownerId, story.assigneeId);

  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, image: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title={story.name}
        description={story.description ?? undefined}
        breadcrumbs={
          <>
            {story.epic.initiative ? (
              <>
                <Link href={`/initiatives/${story.epic.initiative.id}`}>
                  {story.epic.initiative.name}
                </Link>{" "}
                /{" "}
              </>
            ) : story.epic.product ? (
              <>
                <Link href={`/products/${story.epic.product.id}`}>
                  {story.epic.product.name}
                </Link>{" "}
                /{" "}
              </>
            ) : null}
            <Link href={`/epics/${story.epic.id}`}>{story.epic.name}</Link>
          </>
        }
        action={
          canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/stories/${story.id}/edit`}>Edit</Link>
              </Button>
              {canWrite(user) && isAIConfigured() && (
                <SuggestChildrenButton
                  parentKind="STORY"
                  parentId={story.id}
                  parentName={story.name}
                  buttonLabel="Suggest tasks"
                />
              )}
            </div>
          )
        }
      />
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-4">
            <Field label="Status"><StatusBadge status={story.status} /></Field>
            <Field label="Priority"><PriorityBadge priority={story.priority} /></Field>
            <Field label="Target"><span className="text-sm">{formatDate(story.targetDate)}</span></Field>
            <Field label="Assignee">
              <div className="flex items-center gap-2">
                <OwnerAvatar name={story.assignee?.name} image={story.assignee?.image} />
                <span className="text-sm">{story.assignee?.name ?? "Unassigned"}</span>
              </div>
            </Field>
          </CardContent>
        </Card>
        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks">Tasks ({story.tasks.length})</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="tasks">
            <TaskList
              storyId={story.id}
              tasks={story.tasks}
              users={allUsers}
              canEdit={canEdit}
            />
          </TabsContent>
          <TabsContent value="comments">
            <Comments itemType="STORY" itemId={story.id} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityFeed itemType="STORY" itemId={story.id} />
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
