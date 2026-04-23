import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, canWriteAssigned } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StoryForm } from "../../story-form";
import { updateStory, deleteStory } from "../../actions";
import { DeleteButton } from "@/components/work/delete-button";

export default async function EditStoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const [story, owners] = await Promise.all([
    prisma.story.findUnique({ where: { id } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
  ]);
  if (!story) notFound();
  if (!canWriteAssigned(user, story.ownerId, story.assigneeId)) notFound();

  async function action(input: any) {
    "use server";
    return updateStory(id, { ...input, epicId: story!.epicId });
  }
  async function remove() {
    "use server";
    return deleteStory(id);
  }

  return (
    <div>
      <PageHeader title={`Edit ${story.name}`} />
      <div className="container max-w-2xl space-y-4 py-6">
        <Card>
          <CardContent className="pt-6">
            <StoryForm
              action={action}
              owners={owners}
              initial={story}
              submitLabel="Save changes"
              onSuccessHref={() => `/stories/${id}`}
            />
          </CardContent>
        </Card>
        <DeleteButton action={remove} redirectTo={`/epics/${story.epicId}`} label="Delete story" />
      </div>
    </div>
  );
}
