import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { csvResponse, toCSV } from "@/lib/csv";
import type { WorkStatus } from "@prisma/client";

const ACTIVE: WorkStatus[] = ["DRAFT", "PLANNED", "IN_PROGRESS", "IN_REVIEW"];

export async function GET(req: NextRequest) {
  await requireUser();
  const sp = req.nextUrl.searchParams;
  const teamId = sp.get("teamId") ?? undefined;

  const users = await prisma.user.findMany({
    where: teamId ? { profile: { teamId } } : undefined,
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
  });

  const rows = users.map((u) => {
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
      user: u.name ?? u.email,
      email: u.email,
      team: u.profile?.team?.name ?? "",
      initiatives: u.ownedInitiatives.length,
      epics: u.ownedEpics.length,
      stories: allStories.length,
      tasks: allTasks.length,
      active,
      done,
    };
  });

  return csvResponse(
    "workload.csv",
    toCSV(rows, [
      "user",
      "email",
      "team",
      "initiatives",
      "epics",
      "stories",
      "tasks",
      "active",
      "done",
    ]),
  );
}
