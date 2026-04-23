import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { OwnerAvatar } from "@/components/work/owner-avatar";
import { ReportToolbar } from "@/components/reports/report-toolbar";
import { WorkloadTeamFilter } from "./team-filter";
import type { WorkStatus } from "@prisma/client";

type Row = {
  userId: string;
  name: string;
  image: string | null;
  teamName: string | null;
  counts: {
    initiatives: number;
    epics: number;
    stories: number;
    tasks: number;
    active: number;
    done: number;
  };
};

const ACTIVE: WorkStatus[] = ["DRAFT", "PLANNED", "IN_PROGRESS", "IN_REVIEW"];

export default async function WorkloadReport({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;

  const [teams, users] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: sp.teamId ? { profile: { teamId: sp.teamId } } : undefined,
      include: {
        profile: { include: { team: true } },
        ownedInitiatives: true,
        ownedEpics: true,
        ownedStories: true,
        assignedStories: true,
        ownedTasks: true,
        assignedTasks: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows: Row[] = users.map((u) => {
    const storyIds = new Set<string>();
    u.ownedStories.forEach((s) => storyIds.add(s.id));
    u.assignedStories.forEach((s) => storyIds.add(s.id));
    const taskIds = new Set<string>();
    u.ownedTasks.forEach((t) => taskIds.add(t.id));
    u.assignedTasks.forEach((t) => taskIds.add(t.id));

    const allStories = [...u.ownedStories, ...u.assignedStories].filter(
      (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i,
    );
    const allTasks = [...u.ownedTasks, ...u.assignedTasks].filter(
      (t, i, arr) => arr.findIndex((x) => x.id === t.id) === i,
    );

    const active =
      u.ownedInitiatives.filter((x) => ACTIVE.includes(x.status)).length +
      u.ownedEpics.filter((x) => ACTIVE.includes(x.status)).length +
      allStories.filter((x) => ACTIVE.includes(x.status)).length +
      allTasks.filter((x) => ACTIVE.includes(x.status)).length;
    const done =
      u.ownedInitiatives.filter((x) => x.status === "DONE" || x.status === "RELEASED").length +
      u.ownedEpics.filter((x) => x.status === "DONE" || x.status === "RELEASED").length +
      allStories.filter((x) => x.status === "DONE" || x.status === "RELEASED").length +
      allTasks.filter((x) => x.status === "DONE" || x.status === "RELEASED").length;

    return {
      userId: u.id,
      name: u.name ?? u.email,
      image: u.image,
      teamName: u.profile?.team?.name ?? null,
      counts: {
        initiatives: u.ownedInitiatives.length,
        epics: u.ownedEpics.length,
        stories: storyIds.size,
        tasks: taskIds.size,
        active,
        done,
      },
    };
  });

  rows.sort((a, b) => b.counts.active - a.counts.active);

  const qs = new URLSearchParams();
  if (sp.teamId) qs.set("teamId", sp.teamId);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Workload report"
        description="Assignments per person across active work."
        breadcrumbs={<Link href="/reports">Reports</Link>}
      />
      <div className="flex-1 overflow-auto p-6 print-container">
        <ReportToolbar csvHref={`/api/reports/workload?${qs.toString()}`}>
          <WorkloadTeamFilter teams={teams} teamId={sp.teamId} />
        </ReportToolbar>

        <div className="mt-4 rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Person</th>
                <th className="px-3 py-2 text-left font-medium">Team</th>
                <th className="px-3 py-2 text-right font-medium">Initiatives</th>
                <th className="px-3 py-2 text-right font-medium">Epics</th>
                <th className="px-3 py-2 text-right font-medium">Stories</th>
                <th className="px-3 py-2 text-right font-medium">Tasks</th>
                <th className="px-3 py-2 text-right font-medium">Active</th>
                <th className="px-3 py-2 text-right font-medium">Done</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.userId}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <OwnerAvatar name={r.name} image={r.image} />
                      <span>{r.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.teamName ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.counts.initiatives}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.counts.epics}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.counts.stories}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.counts.tasks}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{r.counts.active}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                    {r.counts.done}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    No users match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

