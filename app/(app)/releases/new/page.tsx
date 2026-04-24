import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ReleaseForm } from "../release-form";
import { createRelease } from "../actions";

export default async function NewReleasePage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>;
}) {
  await assertCanWrite();
  const { productId } = await searchParams;
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  async function action(input: any) {
    "use server";
    return createRelease(input);
  }

  return (
    <div>
      <PageHeader
        title="New release"
        backHref={productId ? `/products/${productId}` : "/releases"}
        backLabel={productId ? "View product" : "All releases"}
        breadcrumbs={<Link href="/releases">Releases</Link>}
      />
      <div className="container max-w-2xl py-6">
        <Card>
          <CardContent className="pt-6">
            <ReleaseForm
              action={action}
              products={products}
              initial={{ productId: productId ?? products[0]?.id }}
              submitLabel="Create release"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
