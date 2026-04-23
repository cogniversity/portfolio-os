import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { InitiativeForm } from "../../initiative-form";
import { updateInitiative, deleteInitiative } from "../../actions";
import { DeleteButton } from "@/components/work/delete-button";

export default async function EditInitiativePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await assertCanWrite();
  const [init, owners, products, types] = await Promise.all([
    prisma.initiative.findUnique({
      where: { id },
      include: {
        products: true,
        fieldValues: { include: { definition: true } },
      },
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.initiativeType.findMany({
      include: { fields: { orderBy: { orderIndex: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!init) notFound();

  const initialCustomFields: Record<string, any> = {};
  for (const fv of init.fieldValues) {
    initialCustomFields[fv.definition.key] = fv.value;
  }

  async function action(input: any) {
    "use server";
    return updateInitiative(id, input);
  }
  async function remove() {
    "use server";
    return deleteInitiative(id);
  }

  return (
    <div>
      <PageHeader
        title={`Edit ${init.name}`}
        breadcrumbs={<><Link href="/initiatives">Initiatives</Link> / <Link href={`/initiatives/${id}`}>{init.name}</Link></>}
      />
      <div className="container max-w-2xl space-y-4 py-6">
        <Card>
          <CardContent className="pt-6">
            <InitiativeForm
              action={action}
              owners={owners}
              products={products}
              types={types}
              initial={{
                ...init,
                productIds: init.products.map((p) => p.productId),
              }}
              initialCustomFields={initialCustomFields}
              submitLabel="Save changes"
            />
          </CardContent>
        </Card>
        <DeleteButton action={remove} redirectTo="/initiatives" label="Delete initiative" />
      </div>
    </div>
  );
}
