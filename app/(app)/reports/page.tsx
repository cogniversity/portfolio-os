import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card } from "@/components/ui/card";
import { FileBarChart2, Rocket, Users, Target, Map } from "lucide-react";

const REPORTS = [
  {
    href: "/reports/release-plan",
    title: "Release plan",
    icon: Rocket,
    description: "Per-release scope, owners, dates, and status.",
  },
  {
    href: "/reports/roadmap",
    title: "Roadmap export",
    icon: Map,
    description: "Initiatives and epics by product and quarter.",
  },
  {
    href: "/reports/workload",
    title: "Workload",
    icon: Users,
    description: "Assignments per person and team across active work.",
  },
  {
    href: "/reports/initiative-by-type",
    title: "Initiative by type",
    icon: Target,
    description: "All initiatives grouped by type with custom fields.",
  },
];

export default async function ReportsIndex() {
  await requireUser();
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Reports"
        description="Filterable tables with CSV export and printable views."
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((r) => {
            const Icon = r.icon;
            return (
              <Link key={r.href} href={r.href} className="group">
                <Card className="flex h-full flex-col gap-2 p-5 transition hover:border-primary/50 hover:shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h2 className="text-base font-semibold group-hover:text-primary">
                      {r.title}
                    </h2>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.description}</p>
                  <div className="mt-auto text-[11px] uppercase tracking-wider text-muted-foreground">
                    <FileBarChart2 className="mr-1 inline h-3 w-3" />
                    Open report
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
