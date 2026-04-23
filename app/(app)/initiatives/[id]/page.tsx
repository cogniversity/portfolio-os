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
import { HierarchyTree, type TreeNode } from "@/components/work/hierarchy-tree";
import { ActivityFeed } from "@/components/collab/activity-feed";
import { Comments } from "@/components/collab/comments";

export default async function InitiativeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const init = await prisma.initiative.findUnique({
    where: { id },
    include: {
      owner: true,
      type: { include: { fields: { orderBy: { orderIndex: "asc" } } } },
      products: { include: { product: true } },
      fieldValues: { include: { definition: true } },
      epics: {
        include: {
          owner: true,
          stories: {
            include: {
              owner: true,
              assignee: true,
              tasks: { include: { owner: true, assignee: true } },
            },
          },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });
  if (!init) notFound();

  const treeNodes: TreeNode[] = init.epics.map((e) => ({
    id: e.id,
    name: e.name,
    href: `/epics/${e.id}`,
    status: e.status,
    priority: e.priority,
    owner: e.owner ? { name: e.owner.name, image: e.owner.image } : null,
    kind: "Epic",
    children: e.stories.map((s) => ({
      id: s.id,
      name: s.name,
      href: `/stories/${s.id}`,
      status: s.status,
      priority: s.priority,
      owner:
        (s.assignee ?? s.owner)
          ? {
              name: (s.assignee ?? s.owner)!.name,
              image: (s.assignee ?? s.owner)!.image,
            }
          : null,
      kind: "Story",
      children: s.tasks.map((t) => ({
        id: t.id,
        name: t.name,
        href: `/stories/${s.id}#task-${t.id}`,
        status: t.status,
        priority: t.priority,
        owner:
          (t.assignee ?? t.owner)
            ? {
                name: (t.assignee ?? t.owner)!.name,
                image: (t.assignee ?? t.owner)!.image,
              }
            : null,
        kind: "Task",
      })),
    })),
  }));

  return (
    <div>
      <PageHeader
        title={init.name}
        description={init.description ?? undefined}
        breadcrumbs={<Link href="/initiatives">Initiatives</Link>}
        action={
          canWrite(user) && (
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/initiatives/${init.id}/edit`}>Edit</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/epics/new?initiativeId=${init.id}`}>
                  <Plus className="h-4 w-4" /> Add epic
                </Link>
              </Button>
            </div>
          )
        }
      />
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-5">
            <Field label="Type">
              {init.type ? (
                <div className="flex items-center gap-1.5 text-sm">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: init.type.color }}
                  />
                  {init.type.name}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="Status"><StatusBadge status={init.status} /></Field>
            <Field label="Priority"><PriorityBadge priority={init.priority} /></Field>
            <Field label="Target"><span className="text-sm">{formatDate(init.targetDate)}</span></Field>
            <Field label="Owner">
              <div className="flex items-center gap-2">
                <OwnerAvatar name={init.owner?.name} image={init.owner?.image} />
                <span className="text-sm">{init.owner?.name ?? "Unassigned"}</span>
              </div>
            </Field>
          </CardContent>
        </Card>
        {init.products.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Products
              </div>
              <div className="flex flex-wrap gap-2">
                {init.products.map(({ product: p }) => (
                  <Link
                    key={p.id}
                    href={`/products/${p.id}`}
                    className="rounded-md border bg-muted/30 px-2.5 py-1 text-sm hover:bg-accent"
                  >
                    {p.name}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        <Tabs defaultValue="hierarchy">
          <TabsList>
            <TabsTrigger value="hierarchy">Epics · Stories · Tasks</TabsTrigger>
            {init.type && init.type.fields.length > 0 && (
              <TabsTrigger value="fields">Custom fields</TabsTrigger>
            )}
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="hierarchy">
            <HierarchyTree nodes={treeNodes} />
          </TabsContent>
          {init.type && init.type.fields.length > 0 && (
            <TabsContent value="fields">
              <Card>
                <CardContent className="space-y-3 pt-6">
                  {init.type.fields.map((f) => {
                    const val = init.fieldValues.find(
                      (v) => v.definitionId === f.id,
                    );
                    return (
                      <div key={f.id} className="grid grid-cols-3 gap-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {f.label}
                        </div>
                        <div className="col-span-2 text-sm">
                          {formatCustomValue(val?.value)}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>
          )}
          <TabsContent value="comments">
            <Comments itemType="INITIATIVE" itemId={init.id} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityFeed itemType="INITIATIVE" itemId={init.id} />
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

function formatCustomValue(value: any): React.ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}
