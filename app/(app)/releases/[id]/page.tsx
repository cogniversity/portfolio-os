import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, canWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { RELEASE_STATUS_LABELS } from "@/lib/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReleaseScopePicker } from "./scope-picker";
import { WorkItemRowList } from "@/components/work/work-item-row";
import { ActivityFeed } from "@/components/collab/activity-feed";
import { Comments } from "@/components/collab/comments";

export default async function ReleaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const release = await prisma.release.findUnique({
    where: { id },
    include: {
      product: true,
      epics: {
        include: { epic: { include: { owner: true, initiative: true } } },
      },
      stories: {
        include: {
          story: { include: { owner: true, assignee: true, epic: true } },
        },
      },
    },
  });
  if (!release) notFound();

  const candidateEpics = await prisma.epic.findMany({
    where: {
      initiative: {
        products: { some: { productId: release.productId } },
      },
    },
    include: { initiative: true },
    orderBy: { name: "asc" },
  });
  const candidateStories = await prisma.story.findMany({
    where: {
      epic: { initiative: { products: { some: { productId: release.productId } } } },
    },
    include: { epic: true },
    orderBy: { name: "asc" },
  });

  const epicItems = release.epics.map(({ epic }) => ({
    id: epic.id,
    name: epic.name,
    href: `/epics/${epic.id}`,
    status: epic.status,
    priority: epic.priority,
    targetDate: epic.targetDate,
    owner: epic.owner ? { name: epic.owner.name, image: epic.owner.image } : null,
    meta: epic.initiative.name,
  }));

  const storyItems = release.stories.map(({ story }) => ({
    id: story.id,
    name: story.name,
    href: `/stories/${story.id}`,
    status: story.status,
    priority: story.priority,
    targetDate: story.targetDate,
    owner: (story.assignee ?? story.owner)
      ? { name: (story.assignee ?? story.owner)!.name, image: (story.assignee ?? story.owner)!.image }
      : null,
    meta: story.epic.name,
  }));

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {release.name}
            {release.version && (
              <Badge variant="outline" className="font-mono">{release.version}</Badge>
            )}
          </span>
        }
        description={release.description ?? undefined}
        breadcrumbs={
          <>
            <Link href="/releases">Releases</Link> /{" "}
            <Link href={`/products/${release.product.id}`}>{release.product.name}</Link>
          </>
        }
        action={
          canWrite(user) && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/releases/${release.id}/edit`}>Edit</Link>
            </Button>
          )
        }
      />
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-4">
            <Field label="Status">
              <Badge variant="secondary">{RELEASE_STATUS_LABELS[release.status]}</Badge>
            </Field>
            <Field label="Planned"><span className="text-sm">{formatDate(release.plannedDate)}</span></Field>
            <Field label="Actual"><span className="text-sm">{formatDate(release.actualDate)}</span></Field>
            <Field label="Scope"><span className="text-sm">{release.epics.length} epics, {release.stories.length} stories</span></Field>
          </CardContent>
        </Card>
        <Tabs defaultValue="scope">
          <TabsList>
            <TabsTrigger value="scope">Scope</TabsTrigger>
            <TabsTrigger value="manage">Manage scope</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="scope" className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Epics ({epicItems.length})</h3>
              <WorkItemRowList items={epicItems} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Stories ({storyItems.length})</h3>
              <WorkItemRowList items={storyItems} />
            </div>
          </TabsContent>
          <TabsContent value="manage">
            {canWrite(user) ? (
              <ReleaseScopePicker
                releaseId={release.id}
                epics={candidateEpics.map((e) => ({
                  id: e.id,
                  name: e.name,
                  initiative: e.initiative.name,
                  selected: release.epics.some((re) => re.epicId === e.id),
                }))}
                stories={candidateStories.map((s) => ({
                  id: s.id,
                  name: s.name,
                  epic: s.epic.name,
                  selected: release.stories.some((rs) => rs.storyId === s.id),
                }))}
              />
            ) : (
              <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
                Only Product Managers can modify release scope.
              </div>
            )}
          </TabsContent>
          <TabsContent value="comments">
            <Comments itemType="RELEASE" itemId={release.id} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityFeed itemType="RELEASE" itemId={release.id} />
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
