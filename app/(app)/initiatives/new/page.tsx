import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { InitiativeForm } from "../initiative-form";
import { createInitiative } from "../actions";

export default async function NewInitiativePage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>;
}) {
  await assertCanWrite();
  const { productId } = await searchParams;
  const [owners, products, types] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.initiativeType.findMany({
      include: { fields: { orderBy: { orderIndex: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  async function action(input: any) {
    "use server";
    return createInitiative(input);
  }

  return (
    <div>
      <PageHeader title="New initiative" breadcrumbs={<Link href="/initiatives">Initiatives</Link>} />
      <div className="container max-w-2xl py-6">
        <Card>
          <CardContent className="pt-6">
            <InitiativeForm
              action={action}
              owners={owners}
              products={products}
              types={types}
              initialProductId={productId}
              submitLabel="Create initiative"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
