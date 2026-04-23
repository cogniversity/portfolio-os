import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ProductForm } from "../product-form";
import { createProduct } from "../actions";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ portfolioId?: string }>;
}) {
  await assertCanWrite();
  const { portfolioId } = await searchParams;
  const [owners, portfolios] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.portfolio.findMany({ orderBy: { name: "asc" } }),
  ]);

  async function action(input: any) {
    "use server";
    return createProduct(input);
  }

  return (
    <div>
      <PageHeader title="New product" breadcrumbs={<Link href="/products">Products</Link>} />
      <div className="container max-w-2xl py-6">
        <Card>
          <CardContent className="pt-6">
            <ProductForm
              action={action}
              owners={owners}
              portfolios={portfolios}
              initialPortfolioId={portfolioId}
              submitLabel="Create product"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
