import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { WorkItemForm } from "@/components/work/work-item-form";
import { updateEpic, deleteEpic } from "../../actions";
import { DeleteButton } from "@/components/work/delete-button";

export default async function EditEpicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await assertCanWrite();
  const [epic, owners] = await Promise.all([
    prisma.epic.findUnique({ where: { id } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
  ]);
  if (!epic) notFound();

  async function action(input: any) {
    "use server";
    return updateEpic(id, { ...input, initiativeId: epic!.initiativeId });
  }
  async function remove() {
    "use server";
    return deleteEpic(id);
  }

  return (
    <div>
      <PageHeader title={`Edit ${epic.name}`} />
      <div className="container max-w-2xl space-y-4 py-6">
        <Card>
          <CardContent className="pt-6">
            <WorkItemForm
              action={action}
              owners={owners}
              initial={epic}
              submitLabel="Save changes"
              onSuccessHref={() => `/epics/${id}`}
            />
          </CardContent>
        </Card>
        <DeleteButton
          action={remove}
          redirectTo={`/initiatives/${epic.initiativeId}`}
          label="Delete epic"
        />
      </div>
    </div>
  );
}
