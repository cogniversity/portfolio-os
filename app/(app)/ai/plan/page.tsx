import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { isAIConfigured } from "@/lib/ai/client";
import { AiPlanClient } from "./ai-plan-client";

export default async function AiPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>;
}) {
  await assertCanWrite();
  const { productId } = await searchParams;

  const [products, types] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.initiativeType.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const configured = isAIConfigured();

  return (
    <div>
      <PageHeader
        title="Plan with AI"
        description="Paste a brief, PRD, or transcript. AI drafts initiatives, epics, and stories. You review, edit, and confirm before anything is created."
        breadcrumbs={
          <span>
            <Link href="/dashboard" className="hover:underline">
              Dashboard
            </Link>
            {" / Planning"}
          </span>
        }
      />
      <div className="container max-w-4xl py-6">
        <Card>
          <CardContent className="pt-6">
            {configured ? (
              <AiPlanClient
                products={products}
                initiativeTypes={types}
                defaultProductId={productId ?? null}
              />
            ) : (
              <div className="py-6 text-center space-y-2">
                <p className="text-sm font-medium">AI is not configured.</p>
                <p className="text-sm text-muted-foreground">
                  Set <code className="rounded bg-muted px-1.5 py-0.5 text-xs">OPENAI_API_KEY</code>{" "}
                  in your environment to enable AI planning.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
