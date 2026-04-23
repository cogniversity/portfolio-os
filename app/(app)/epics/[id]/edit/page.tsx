import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EpicForm } from "@/components/work/epic-form";
import { updateEpic, deleteEpic } from "../../actions";
import { DeleteButton } from "@/components/work/delete-button";

export default async function EditEpicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await assertCanWrite();
  const [epic, owners, initiatives, products] = await Promise.all([
    prisma.epic.findUnique({ where: { id } }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.initiative.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!epic) notFound();

  async function action(input: Parameters<typeof updateEpic>[1]) {
    "use server";
    return updateEpic(id, input);
  }
  async function remove() {
    "use server";
    return deleteEpic(id);
  }

  const fallbackHref = epic.initiativeId
    ? `/initiatives/${epic.initiativeId}`
    : epic.productId
      ? `/products/${epic.productId}`
      : "/initiatives";

  return (
    <div>
      <PageHeader title={`Edit ${epic.name}`} />
      <div className="container max-w-2xl space-y-4 py-6">
        <Card>
          <CardContent className="pt-6">
            <EpicForm
              action={action}
              owners={owners}
              initiatives={initiatives}
              products={products}
              initial={epic}
              submitLabel="Save changes"
              onSuccessHref={() => `/epics/${id}`}
            />
          </CardContent>
        </Card>
        <DeleteButton action={remove} redirectTo={fallbackHref} label="Delete epic" />
      </div>
    </div>
  );
}
