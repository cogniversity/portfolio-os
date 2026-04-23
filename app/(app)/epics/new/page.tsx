import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { WorkItemForm } from "@/components/work/work-item-form";
import { createEpic } from "../actions";

export default async function NewEpicPage({
  searchParams,
}: {
  searchParams: Promise<{ initiativeId?: string }>;
}) {
  await assertCanWrite();
  const { initiativeId } = await searchParams;
  if (!initiativeId) redirect("/initiatives");
  const [owners, initiative] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.initiative.findUnique({ where: { id: initiativeId } }),
  ]);
  if (!initiative) redirect("/initiatives");

  async function action(input: any) {
    "use server";
    return createEpic({ ...input, initiativeId });
  }

  return (
    <div>
      <PageHeader
        title={`New epic in ${initiative.name}`}
        breadcrumbs={
          <>
            <Link href="/initiatives">Initiatives</Link> /{" "}
            <Link href={`/initiatives/${initiative.id}`}>{initiative.name}</Link>
          </>
        }
      />
      <div className="container max-w-2xl py-6">
        <Card>
          <CardContent className="pt-6">
            <WorkItemForm
              action={action}
              owners={owners}
              submitLabel="Create epic"
              onSuccessHref={(id) => `/epics/${id}`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
