import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { WorkItemForm } from "@/components/work/work-item-form";
import { updatePortfolio, deletePortfolio } from "../../actions";
import { DeleteButton } from "@/components/work/delete-button";

export default async function EditPortfolioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await assertCanWrite();
  const [p, owners] = await Promise.all([
    prisma.portfolio.findUnique({ where: { id } }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!p) notFound();

  async function action(input: any) {
    "use server";
    return updatePortfolio(id, input);
  }

  async function remove() {
    "use server";
    return deletePortfolio(id);
  }

  return (
    <div>
      <PageHeader
        title={`Edit ${p.name}`}
        backHref={`/portfolios/${id}`}
        backLabel="View portfolio"
        breadcrumbs={<><Link href="/portfolios">Portfolios</Link> / <Link href={`/portfolios/${id}`}>{p.name}</Link></>}
      />
      <div className="container max-w-2xl space-y-4 py-6">
        <Card>
          <CardContent className="pt-6">
            <WorkItemForm
              action={action}
              owners={owners}
              initial={p}
              submitLabel="Save changes"
              onSuccessHref={`/portfolios/${id}`}
              aiContext={{ kind: "PORTFOLIO" }}
            />
          </CardContent>
        </Card>
        <DeleteButton action={remove} redirectTo="/portfolios" label="Delete portfolio" />
      </div>
    </div>
  );
}
