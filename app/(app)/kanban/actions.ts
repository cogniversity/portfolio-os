"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { canWriteAssigned, requireUser } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import type { WorkStatus } from "@prisma/client";

const moveSchema = z.object({
  kind: z.enum(["story", "epic", "task"]),
  id: z.string(),
  status: z.enum([
    "DRAFT",
    "PLANNED",
    "IN_PROGRESS",
    "IN_REVIEW",
    "DONE",
    "RELEASED",
    "CANCELLED",
  ]),
});

export async function moveCardAction(input: z.input<typeof moveSchema>) {
  const user = await requireUser();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const { kind, id, status } = parsed.data;

  if (kind === "story") {
    const s = await prisma.story.findUniqueOrThrow({ where: { id } });
    if (!canWriteAssigned(user, s.ownerId, s.assigneeId)) {
      return { ok: false as const, error: "Permission denied" };
    }
    if (s.status === status) return { ok: true as const };
    await prisma.story.update({ where: { id }, data: { status: status as WorkStatus } });
    await logActivity({
      itemType: "STORY",
      itemId: id,
      actorId: user.id,
      kind: "STATUS_CHANGED",
      summary: `Status: ${s.status} → ${status}`,
      diff: { from: s.status, to: status },
    });
  } else if (kind === "epic") {
    const e = await prisma.epic.findUniqueOrThrow({ where: { id } });
    if (!canWriteAssigned(user, e.ownerId, null)) {
      return { ok: false as const, error: "Permission denied" };
    }
    if (e.status === status) return { ok: true as const };
    await prisma.epic.update({ where: { id }, data: { status: status as WorkStatus } });
    await logActivity({
      itemType: "EPIC",
      itemId: id,
      actorId: user.id,
      kind: "STATUS_CHANGED",
      summary: `Status: ${e.status} → ${status}`,
      diff: { from: e.status, to: status },
    });
  } else {
    const t = await prisma.task.findUniqueOrThrow({ where: { id } });
    if (!canWriteAssigned(user, t.ownerId, t.assigneeId)) {
      return { ok: false as const, error: "Permission denied" };
    }
    if (t.status === status) return { ok: true as const };
    await prisma.task.update({ where: { id }, data: { status: status as WorkStatus } });
    await logActivity({
      itemType: "TASK",
      itemId: id,
      actorId: user.id,
      kind: "STATUS_CHANGED",
      summary: `Status: ${t.status} → ${status}`,
      diff: { from: t.status, to: status },
    });
  }

  revalidatePath("/kanban");
  return { ok: true as const };
}
