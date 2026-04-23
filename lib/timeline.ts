import { prisma } from "@/lib/db";
import {
  addDays,
  differenceInCalendarDays,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  endOfWeek,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  addWeeks,
  addMonths,
  addQuarters,
  addYears,
} from "date-fns";

export type Granularity = "week" | "month" | "quarter" | "year";

export type ShiftTarget =
  | { kind: "initiative"; id: string }
  | { kind: "epic"; id: string }
  | { kind: "story"; id: string };

export type MovedItem = {
  kind: "initiative" | "epic" | "story";
  id: string;
  name: string;
  fromStart: Date | null;
  fromEnd: Date | null;
  toStart: Date | null;
  toEnd: Date | null;
};

export type ReleaseImpact = {
  releaseId: string;
  releaseName: string;
  plannedDate: Date | null;
  suggestedDate: Date | null;
  deltaDays: number;
  breaks: boolean;
};

export type ShiftImpact = {
  moved: MovedItem[];
  releaseImpacts: ReleaseImpact[];
  summary: string;
};

export function floorToGranularity(d: Date, g: Granularity): Date {
  switch (g) {
    case "week": return startOfWeek(d, { weekStartsOn: 1 });
    case "month": return startOfMonth(d);
    case "quarter": return startOfQuarter(d);
    case "year": return startOfYear(d);
  }
}

export function ceilToGranularity(d: Date, g: Granularity): Date {
  switch (g) {
    case "week": return endOfWeek(d, { weekStartsOn: 1 });
    case "month": return endOfMonth(d);
    case "quarter": return endOfQuarter(d);
    case "year": return endOfYear(d);
  }
}

export function advanceGranularity(d: Date, g: Granularity, n = 1): Date {
  switch (g) {
    case "week": return addWeeks(d, n);
    case "month": return addMonths(d, n);
    case "quarter": return addQuarters(d, n);
    case "year": return addYears(d, n);
  }
}

export function buildTimelineRange(
  start: Date,
  end: Date,
  granularity: Granularity,
) {
  const s = floorToGranularity(start, granularity);
  const e = ceilToGranularity(end, granularity);
  const buckets: Date[] = [];
  let cur = s;
  while (cur <= e) {
    buckets.push(cur);
    cur = advanceGranularity(cur, granularity);
  }
  return buckets;
}

/**
 * Compute the impact of shifting an initiative/epic/story's start+end dates.
 * - cascades to children proportionally
 * - bubbles up parent target dates (max of children)
 * - detects release impacts (shifts planned release dates if breaking)
 */
export async function computeShiftImpact(
  target: ShiftTarget,
  newStart: Date | null,
  newEnd: Date | null,
): Promise<ShiftImpact> {
  const moved: MovedItem[] = [];

  if (target.kind === "initiative") {
    const init = await prisma.initiative.findUniqueOrThrow({
      where: { id: target.id },
      include: {
        epics: {
          include: {
            stories: true,
          },
        },
      },
    });

    const deltaStart = diffDays(init.startDate, newStart);
    const deltaEnd = diffDays(init.targetDate, newEnd);

    moved.push({
      kind: "initiative",
      id: init.id,
      name: init.name,
      fromStart: init.startDate,
      fromEnd: init.targetDate,
      toStart: newStart,
      toEnd: newEnd,
    });

    for (const epic of init.epics) {
      const epicNewStart = shiftDate(epic.startDate, deltaStart);
      const epicNewEnd = shiftDate(epic.targetDate, deltaEnd);
      if (changed(epic.startDate, epicNewStart) || changed(epic.targetDate, epicNewEnd)) {
        moved.push({
          kind: "epic",
          id: epic.id,
          name: epic.name,
          fromStart: epic.startDate,
          fromEnd: epic.targetDate,
          toStart: epicNewStart,
          toEnd: epicNewEnd,
        });
      }
      for (const story of epic.stories) {
        const storyNewStart = shiftDate(story.startDate, deltaStart);
        const storyNewEnd = shiftDate(story.targetDate, deltaEnd);
        if (changed(story.startDate, storyNewStart) || changed(story.targetDate, storyNewEnd)) {
          moved.push({
            kind: "story",
            id: story.id,
            name: story.name,
            fromStart: story.startDate,
            fromEnd: story.targetDate,
            toStart: storyNewStart,
            toEnd: storyNewEnd,
          });
        }
      }
    }
  } else if (target.kind === "epic") {
    const epic = await prisma.epic.findUniqueOrThrow({
      where: { id: target.id },
      include: { stories: true, initiative: true },
    });
    const deltaStart = diffDays(epic.startDate, newStart);
    const deltaEnd = diffDays(epic.targetDate, newEnd);
    moved.push({
      kind: "epic",
      id: epic.id,
      name: epic.name,
      fromStart: epic.startDate,
      fromEnd: epic.targetDate,
      toStart: newStart,
      toEnd: newEnd,
    });
    for (const story of epic.stories) {
      const ns = shiftDate(story.startDate, deltaStart);
      const ne = shiftDate(story.targetDate, deltaEnd);
      if (changed(story.startDate, ns) || changed(story.targetDate, ne)) {
        moved.push({
          kind: "story",
          id: story.id,
          name: story.name,
          fromStart: story.startDate,
          fromEnd: story.targetDate,
          toStart: ns,
          toEnd: ne,
        });
      }
    }
    // bubble up parent initiative target (only when epic has an initiative parent)
    if (
      epic.initiative &&
      newEnd &&
      (!epic.initiative.targetDate || newEnd > epic.initiative.targetDate)
    ) {
      moved.push({
        kind: "initiative",
        id: epic.initiative.id,
        name: epic.initiative.name,
        fromStart: epic.initiative.startDate,
        fromEnd: epic.initiative.targetDate,
        toStart: epic.initiative.startDate,
        toEnd: newEnd,
      });
    }
  } else {
    const story = await prisma.story.findUniqueOrThrow({
      where: { id: target.id },
      include: { epic: { include: { initiative: true } } },
    });
    moved.push({
      kind: "story",
      id: story.id,
      name: story.name,
      fromStart: story.startDate,
      fromEnd: story.targetDate,
      toStart: newStart,
      toEnd: newEnd,
    });
    // Bubble up epic and initiative if story end exceeds
    if (newEnd && (!story.epic.targetDate || newEnd > story.epic.targetDate)) {
      moved.push({
        kind: "epic",
        id: story.epic.id,
        name: story.epic.name,
        fromStart: story.epic.startDate,
        fromEnd: story.epic.targetDate,
        toStart: story.epic.startDate,
        toEnd: newEnd,
      });
    }
    if (
      story.epic.initiative &&
      newEnd &&
      (!story.epic.initiative.targetDate ||
        newEnd > story.epic.initiative.targetDate)
    ) {
      moved.push({
        kind: "initiative",
        id: story.epic.initiative.id,
        name: story.epic.initiative.name,
        fromStart: story.epic.initiative.startDate,
        fromEnd: story.epic.initiative.targetDate,
        toStart: story.epic.initiative.startDate,
        toEnd: newEnd,
      });
    }
  }

  // Release impact: any release containing moved epics/stories that now ends after planned date
  const epicIds = moved.filter((m) => m.kind === "epic").map((m) => m.id);
  const storyIds = moved.filter((m) => m.kind === "story").map((m) => m.id);

  const releases = await prisma.release.findMany({
    where: {
      OR: [
        { epics: { some: { epicId: { in: epicIds } } } },
        { stories: { some: { storyId: { in: storyIds } } } },
      ],
    },
    include: {
      epics: { include: { epic: true } },
      stories: { include: { story: true } },
    },
  });

  const releaseImpacts: ReleaseImpact[] = releases.map((r) => {
    const latestEpic = r.epics
      .map((re) => {
        const moved_ = moved.find((m) => m.kind === "epic" && m.id === re.epicId);
        return moved_?.toEnd ?? re.epic.targetDate;
      })
      .filter(Boolean) as Date[];
    const latestStory = r.stories
      .map((rs) => {
        const moved_ = moved.find((m) => m.kind === "story" && m.id === rs.storyId);
        return moved_?.toEnd ?? rs.story.targetDate;
      })
      .filter(Boolean) as Date[];

    const latest = [...latestEpic, ...latestStory].sort(
      (a, b) => b.getTime() - a.getTime(),
    )[0];
    if (!latest) {
      return {
        releaseId: r.id,
        releaseName: r.name,
        plannedDate: r.plannedDate,
        suggestedDate: r.plannedDate,
        deltaDays: 0,
        breaks: false,
      };
    }
    const plannedTime = r.plannedDate?.getTime() ?? 0;
    const breaks = r.plannedDate ? latest > r.plannedDate : false;
    const deltaDays = r.plannedDate
      ? differenceInCalendarDays(latest, r.plannedDate)
      : 0;
    return {
      releaseId: r.id,
      releaseName: r.name,
      plannedDate: r.plannedDate,
      suggestedDate: breaks ? latest : r.plannedDate,
      deltaDays,
      breaks,
    };
  });

  const epicsMoved = moved.filter((m) => m.kind === "epic").length;
  const storiesMoved = moved.filter((m) => m.kind === "story").length;
  const breaking = releaseImpacts.filter((r) => r.breaks);
  let summary = `Moves ${moved.length} item${moved.length === 1 ? "" : "s"}`;
  if (storiesMoved) summary += ` (${storiesMoved} stor${storiesMoved === 1 ? "y" : "ies"})`;
  if (breaking.length > 0) {
    const biggest = breaking.sort((a, b) => b.deltaDays - a.deltaDays)[0];
    summary += ` and pushes ${breaking.length} release${breaking.length === 1 ? "" : "s"}`;
    if (biggest) summary += ` — largest ${biggest.releaseName} by ${biggest.deltaDays} day${biggest.deltaDays === 1 ? "" : "s"}`;
  }

  return { moved, releaseImpacts, summary };
}

export async function applyShiftImpact(
  impact: ShiftImpact,
  actorId: string,
  alsoPushReleases: boolean,
) {
  await prisma.$transaction(async (tx) => {
    for (const m of impact.moved) {
      if (m.kind === "initiative") {
        await tx.initiative.update({
          where: { id: m.id },
          data: { startDate: m.toStart, targetDate: m.toEnd },
        });
      } else if (m.kind === "epic") {
        await tx.epic.update({
          where: { id: m.id },
          data: { startDate: m.toStart, targetDate: m.toEnd },
        });
      } else {
        await tx.story.update({
          where: { id: m.id },
          data: { startDate: m.toStart, targetDate: m.toEnd },
        });
      }
    }
    if (alsoPushReleases) {
      for (const r of impact.releaseImpacts) {
        if (r.breaks && r.suggestedDate) {
          await tx.release.update({
            where: { id: r.releaseId },
            data: { plannedDate: r.suggestedDate },
          });
        }
      }
    }
    // Log the shift
    for (const m of impact.moved) {
      const itemType = m.kind.toUpperCase() as any;
      await tx.activityLog.create({
        data: {
          itemType,
          itemId: m.id,
          actorId,
          kind: "TIMELINE_SHIFT",
          summary: `Dates shifted: ${fmt(m.fromStart)}→${fmt(m.toStart)} / ${fmt(m.fromEnd)}→${fmt(m.toEnd)}`,
          diff: {
            fromStart: m.fromStart?.toISOString() ?? null,
            toStart: m.toStart?.toISOString() ?? null,
            fromEnd: m.fromEnd?.toISOString() ?? null,
            toEnd: m.toEnd?.toISOString() ?? null,
          },
        },
      });
    }
  });
}

function diffDays(a: Date | null, b: Date | null): number {
  if (!a || !b) return 0;
  return differenceInCalendarDays(b, a);
}
function shiftDate(d: Date | null, days: number): Date | null {
  if (!d) return null;
  if (!days) return d;
  return addDays(d, days);
}
function changed(a: Date | null, b: Date | null) {
  if (a === null && b === null) return false;
  if (!a || !b) return true;
  return a.getTime() !== b.getTime();
}
function fmt(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}
