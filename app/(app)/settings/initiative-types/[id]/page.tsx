import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TypeForm, type FieldDraft } from "../type-form";
import { updateInitiativeType, deleteInitiativeType } from "../actions";
import { DeleteButton } from "@/components/work/delete-button";

export default async function EditTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole("PRODUCT_MANAGER");
  const type = await prisma.initiativeType.findUnique({
    where: { id },
    include: { fields: { orderBy: { orderIndex: "asc" } } },
  });
  if (!type) notFound();

  const initialFields: FieldDraft[] = type.fields.map((f) => ({
    id: f.id,
    key: f.key,
    label: f.label,
    kind: f.kind,
    options: Array.isArray(f.options) ? (f.options as any) : null,
    required: f.required,
  }));

  async function action(input: any) {
    "use server";
    return updateInitiativeType(id, input);
  }
  async function remove() {
    "use server";
    return deleteInitiativeType(id);
  }

  return (
    <div>
      <PageHeader
        title={`Edit ${type.name}`}
        backHref="/settings/initiative-types"
        backLabel="Initiative types"
        breadcrumbs={<Link href="/settings/initiative-types">Initiative Types</Link>}
      />
      <div className="container max-w-3xl space-y-4 py-6">
        <Card>
          <CardContent className="pt-6">
            <TypeForm
              action={action}
              initial={{ name: type.name, color: type.color, fields: initialFields }}
            />
          </CardContent>
        </Card>
        {!type.isBuiltIn && (
          <DeleteButton
            action={remove}
            redirectTo="/settings/initiative-types"
            label="Delete type"
            title={`Delete "${type.name}"?`}
            description="Initiatives using this type will lose their type assignment. Custom field values will be removed."
          />
        )}
      </div>
    </div>
  );
}
