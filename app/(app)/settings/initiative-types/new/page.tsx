import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TypeForm } from "../type-form";
import { createInitiativeType } from "../actions";

export default async function NewTypePage() {
  await requireRole("PRODUCT_MANAGER");
  async function action(input: any) {
    "use server";
    return createInitiativeType(input);
  }
  return (
    <div>
      <PageHeader
        title="New initiative type"
        backHref="/settings/initiative-types"
        backLabel="Initiative types"
        breadcrumbs={<Link href="/settings/initiative-types">Initiative Types</Link>}
      />
      <div className="container max-w-3xl py-6">
        <Card>
          <CardContent className="pt-6">
            <TypeForm action={action} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
