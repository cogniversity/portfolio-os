import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { WorkItemForm } from "@/components/work/work-item-form";
import { createPortfolio } from "../actions";

export default async function NewPortfolioPage() {
  await assertCanWrite();
  const owners = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  async function action(input: any) {
    "use server";
    return createPortfolio(input);
  }

  return (
    <div>
      <PageHeader title="New portfolio" breadcrumbs={<Link href="/portfolios">Portfolios</Link>} />
      <div className="container max-w-2xl py-6">
        <Card>
          <CardContent className="pt-6">
            <WorkItemForm
              action={action}
              owners={owners}
              submitLabel="Create portfolio"
              onSuccessHref={(id) => `/portfolios/${id}`}
              aiContext={{ kind: "PORTFOLIO" }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
