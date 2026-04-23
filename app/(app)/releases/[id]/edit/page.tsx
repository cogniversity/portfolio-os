import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ReleaseForm } from "../../release-form";
import { updateRelease, deleteRelease } from "../../actions";
import { DeleteButton } from "@/components/work/delete-button";

export default async function EditReleasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await assertCanWrite();
  const [release, products] = await Promise.all([
    prisma.release.findUnique({ where: { id } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!release) notFound();

  async function action(input: any) {
    "use server";
    return updateRelease(id, input);
  }
  async function remove() {
    "use server";
    return deleteRelease(id);
  }

  return (
    <div>
      <PageHeader
        title={`Edit ${release.name}`}
        breadcrumbs={
          <>
            <Link href="/releases">Releases</Link> /{" "}
            <Link href={`/releases/${id}`}>{release.name}</Link>
          </>
        }
      />
      <div className="container max-w-2xl space-y-4 py-6">
        <Card>
          <CardContent className="pt-6">
            <ReleaseForm
              action={action}
              products={products}
              initial={release}
              submitLabel="Save changes"
            />
          </CardContent>
        </Card>
        <DeleteButton action={remove} redirectTo="/releases" label="Delete release" />
      </div>
    </div>
  );
}
