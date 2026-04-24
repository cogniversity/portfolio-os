import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EpicForm } from "@/components/work/epic-form";
import { createEpic } from "../actions";

export default async function NewEpicPage({
  searchParams,
}: {
  searchParams: Promise<{ initiativeId?: string; productId?: string }>;
}) {
  await assertCanWrite();
  const { initiativeId, productId } = await searchParams;
  if (!initiativeId && !productId) redirect("/initiatives");

  const [owners, initiatives, products, initiative, product] = await Promise.all([
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
    initiativeId
      ? prisma.initiative.findUnique({ where: { id: initiativeId } })
      : Promise.resolve(null),
    productId
      ? prisma.product.findUnique({ where: { id: productId } })
      : Promise.resolve(null),
  ]);

  if (initiativeId && !initiative) redirect("/initiatives");
  if (productId && !product) redirect("/products");

  async function action(input: Parameters<typeof createEpic>[0]) {
    "use server";
    return createEpic(input);
  }

  const contextName = initiative?.name ?? product?.name ?? "";

  return (
    <div>
      <PageHeader
        title={contextName ? `New epic in ${contextName}` : "New epic"}
        backHref={
          initiative
            ? `/initiatives/${initiative.id}`
            : product
              ? `/products/${product.id}`
              : "/initiatives"
        }
        backLabel={initiative ? "View initiative" : product ? "View product" : "Back"}
        breadcrumbs={
          initiative ? (
            <>
              <Link href="/initiatives">Initiatives</Link> /{" "}
              <Link href={`/initiatives/${initiative.id}`}>{initiative.name}</Link>
            </>
          ) : product ? (
            <>
              <Link href="/products">Products</Link> /{" "}
              <Link href={`/products/${product.id}`}>{product.name}</Link>
            </>
          ) : null
        }
      />
      <div className="container max-w-2xl py-6">
        <Card>
          <CardContent className="pt-6">
            <EpicForm
              action={action}
              owners={owners}
              initiatives={initiatives}
              products={products}
              initial={{
                initiativeId: initiativeId ?? null,
                productId: productId ?? null,
              }}
              submitLabel="Create epic"
              onSuccessHref="/epics/{id}"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
