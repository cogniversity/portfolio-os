import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ProductForm } from "../../product-form";
import { updateProduct, deleteProduct } from "../../actions";
import { DeleteButton } from "@/components/work/delete-button";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await assertCanWrite();
  const [p, owners, portfolios] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.portfolio.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!p) notFound();

  async function action(input: any) {
    "use server";
    return updateProduct(id, input);
  }
  async function remove() {
    "use server";
    return deleteProduct(id);
  }

  return (
    <div>
      <PageHeader
        title={`Edit ${p.name}`}
        backHref={`/products/${id}`}
        backLabel="View product"
        breadcrumbs={<><Link href="/products">Products</Link> / <Link href={`/products/${id}`}>{p.name}</Link></>}
      />
      <div className="container max-w-2xl space-y-4 py-6">
        <Card>
          <CardContent className="pt-6">
            <ProductForm
              action={action}
              owners={owners}
              portfolios={portfolios}
              initial={p}
              submitLabel="Save changes"
            />
          </CardContent>
        </Card>
        <DeleteButton action={remove} redirectTo="/products" label="Delete product" />
      </div>
    </div>
  );
}
