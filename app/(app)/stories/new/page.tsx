import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StoryForm } from "../story-form";
import { createStory } from "../actions";

export default async function NewStoryPage({
  searchParams,
}: {
  searchParams: Promise<{ epicId?: string }>;
}) {
  await requireUser();
  const { epicId } = await searchParams;
  if (!epicId) redirect("/initiatives");
  const [owners, epic] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.epic.findUnique({
      where: { id: epicId },
      include: { initiative: true, product: true },
    }),
  ]);
  if (!epic) redirect("/initiatives");

  async function action(input: any) {
    "use server";
    return createStory({ ...input, epicId });
  }

  return (
    <div>
      <PageHeader
        title={`New story in ${epic.name}`}
        backHref={`/epics/${epicId}`}
        backLabel="View epic"
        breadcrumbs={
          <>
            {epic.initiative ? (
              <>
                <Link href={`/initiatives/${epic.initiative.id}`}>
                  {epic.initiative.name}
                </Link>{" "}
                /{" "}
              </>
            ) : epic.product ? (
              <>
                <Link href={`/products/${epic.product.id}`}>{epic.product.name}</Link>{" "}
                /{" "}
              </>
            ) : null}
            <Link href={`/epics/${epic.id}`}>{epic.name}</Link>
          </>
        }
      />
      <div className="container max-w-2xl py-6">
        <Card>
          <CardContent className="pt-6">
            <StoryForm
              action={action}
              owners={owners}
              submitLabel="Create story"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
