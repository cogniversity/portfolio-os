import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, canWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { RELEASE_STATUS_LABELS } from "@/lib/constants";
import { Rocket } from "lucide-react";

export default async function ReleasesPage() {
  const user = await requireUser();
  const releases = await prisma.release.findMany({
    include: {
      product: true,
      _count: { select: { epics: true, stories: true } },
    },
    orderBy: [{ plannedDate: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <PageHeader
        title="Releases"
        description="Release milestones across all products."
        action={
          canWrite(user) && (
            <Button asChild size="sm">
              <Link href="/releases/new">
                <Plus className="h-4 w-4" /> New release
              </Link>
            </Button>
          )
        }
      />
      <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {releases.map((r) => (
          <Link key={r.id} href={`/releases/${r.id}`}>
            <Card className="transition-colors hover:bg-accent/40">
              <CardContent className="pt-6">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Rocket className="h-4 w-4 text-primary" />
                      <span className="truncate font-medium">{r.name}</span>
                      {r.version && (
                        <span className="text-xs text-muted-foreground">{r.version}</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.product.name}
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {RELEASE_STATUS_LABELS[r.status]}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatDate(r.plannedDate)}</span>
                  <span>
                    {r._count.epics} epics · {r._count.stories} stories
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {releases.length === 0 && (
          <div className="col-span-full rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
            No releases yet.
          </div>
        )}
      </div>
    </div>
  );
}
