import type {
  ActivityKind,
  WorkItemType,
  WorkStatus,
  Priority,
} from "@prisma/client";
import { prisma } from "@/lib/db";

export async function logActivity(args: {
  itemType: WorkItemType;
  itemId: string;
  actorId?: string | null;
  kind: ActivityKind;
  summary: string;
  diff?: Record<string, unknown> | null;
}) {
  await prisma.activityLog.create({
    data: {
      itemType: args.itemType,
      itemId: args.itemId,
      actorId: args.actorId ?? null,
      kind: args.kind,
      summary: args.summary,
      diff: (args.diff ?? undefined) as any,
    },
  });
}

type Changes = Partial<{
  status: WorkStatus;
  priority: Priority;
  startDate: Date | null;
  targetDate: Date | null;
  ownerId: string | null;
  assigneeId: string | null;
  name: string;
  description: string | null;
}>;

export function diffChanges<T extends Changes>(prev: T, next: T) {
  const diff: Record<string, { from: any; to: any }> = {};
  (Object.keys(next) as (keyof T)[]).forEach((key) => {
    const a = prev[key];
    const b = next[key];
    const aVal = a instanceof Date ? a.toISOString() : a;
    const bVal = b instanceof Date ? b.toISOString() : b;
    if (aVal !== bVal) diff[String(key)] = { from: aVal, to: bVal };
  });
  return diff;
}
